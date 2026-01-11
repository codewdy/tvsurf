from service.server.api import api, login, get_user
from service.schema.api import *
from service.lib.context import Context
from service.searcher.searchers import Searchers
import os
from .db import DB
from .local_manager import LocalManager
from .error_db import ErrorDB
from .user_manager import UserManager
from service.schema.user_db import User
from typing import Optional
import threading
from service.schema.config import Config
from .series_manager import SeriesManager
from service.schema.tvdb import TV
from service.schema.user_data import UserData
from .user_data_manager import UserDataManager
from service.schema.tvdb import DownloadStatus


class Tracker:
    def __init__(self, config: Config):
        self.config = config
        self.context: Context = Context(config)
        self.searchers = Searchers()
        self.db = DB()
        self.local_manager = LocalManager()
        self.user_manager = UserManager()
        self.error_db = ErrorDB()
        self.start_event = threading.Event()
        self.series_manager = SeriesManager()
        self.user_data_manager = UserDataManager()

    async def start(self) -> None:
        print("Tracker started")
        await self.context.__aenter__()
        with Context.handle_error("tracker start failed", rethrow=True):
            self.db.start()
            Context.set_data("db", self.db)
            await self.error_db.start()
            await self.local_manager.start()
            await self.series_manager.start()
            await self.user_manager.start()
            self.start_event.set()

    async def stop(self) -> None:
        print("Tracker stopped")
        self.db.save()
        await self.local_manager.stop()
        self.db.stop()
        print("Tracker stopped successfully")
        await self.context.__aexit__(None, None, None)

    def wait_start(self) -> None:
        self.start_event.wait()

    def need_system_setup(self) -> bool:
        return not self.user_manager.has_user()

    def token_validate(self, token: Optional[str]) -> bool:
        return self.get_user(token) is not None

    def resource_url(self, tv: TV, filename: str) -> str:
        return f"/resource/{tv.name}/{filename}"

    def build_tv_info(self, user_data: UserData, tv: TV) -> TVInfo:
        return TVInfo(
            id=tv.id,
            name=tv.name,
            cover_url=self.resource_url(tv, tv.storage.cover),
            series=tv.series,
            last_update=tv.track.last_update,
            total_episodes=len(tv.storage.episodes),
            user_data=self.user_data_manager.get_user_tv_data(user_data, tv.id),
        )

    @get_user
    def get_user(self, token: Optional[str]) -> Optional[User]:
        return self.user_manager.get_user(token)

    @login
    async def system_setup(self, request: SystemSetup.Request) -> SystemSetup.Response:
        if self.user_manager.has_user():
            raise Exception("系统已设置")
        if request.single_user_mode:
            token = self.user_manager.set_single_user_mode()
        else:
            token = self.user_manager.add_user(
                request.username, request.password_md5, ["user", "admin"]
            )
        return SystemSetup.Response(token=token)

    @login
    async def login(self, request: Login.Request) -> Login.Response:
        return Login.Response(
            token=self.user_manager.get_user_token(
                request.username, request.password_md5
            )
        )

    @api("user")
    async def whoami(self, user: User, request: Whoami.Request) -> Whoami.Response:
        return Whoami.Response(
            username=user.username,
            group=user.group,
            single_user_mode=self.user_manager.single_user_mode,
        )

    @api("user")
    async def echo(self, user: User, request: Echo.Request) -> Echo.Response:
        msg = request.message
        return Echo.Response(message=msg)

    @api("user")
    async def search_tv(
        self, user: User, request: SearchTV.Request
    ) -> SearchTV.Response:
        keyword = request.keyword
        source, search_error = await self.searchers.search(keyword)
        return SearchTV.Response(source=source, search_error=search_error)

    @api("user")
    async def add_tv(self, user: User, request: AddTV.Request) -> AddTV.Response:
        name = request.name
        source = request.source
        tv_id = await self.local_manager.add_tv(name, source, request.tracking)
        self.series_manager.add_tv_to_series(tv_id, request.series)
        return AddTV.Response(id=tv_id)

    @api("user")
    async def get_tv_infos(
        self, user: User, request: GetTVInfos.Request
    ) -> GetTVInfos.Response:
        user_data = self.user_data_manager.get_user_data(user.username)

        if request.ids is not None:
            return GetTVInfos.Response(
                tvs=[
                    self.build_tv_info(user_data, self.local_manager.get_tv(id))
                    for id in request.ids
                ]
            )
        else:
            return GetTVInfos.Response(
                tvs=[
                    self.build_tv_info(user_data, tv)
                    for tv in self.local_manager.get_tvs()
                ]
            )

    @api("user")
    async def get_tv_details(
        self, user: User, request: GetTVDetails.Request
    ) -> GetTVDetails.Response:
        user_data = self.user_data_manager.get_user_data(user.username)
        tv = self.local_manager.get_tv(request.id)
        return GetTVDetails.Response(
            tv=tv,
            info=self.build_tv_info(user_data, tv),
            episodes=[
                (
                    self.resource_url(tv, episode.filename)
                    if episode.status == DownloadStatus.SUCCESS
                    else None
                )
                for episode in tv.storage.episodes
            ],
        )

    @api("user")
    async def get_download_progress(
        self, user: User, request: GetDownloadProgress.Request
    ) -> GetDownloadProgress.Response:
        return GetDownloadProgress.Response(
            progress=self.local_manager.get_download_progress()
        )

    @api("user")
    async def get_errors(
        self, user: User, request: GetErrors.Request
    ) -> GetErrors.Response:
        return GetErrors.Response(errors=self.error_db.get_errors())

    @api("user")
    async def remove_errors(
        self, user: User, request: RemoveErrors.Request
    ) -> RemoveErrors.Response:
        self.error_db.remove_errors(request.ids)
        return RemoveErrors.Response()

    @api("user")
    async def add_series(
        self, user: User, request: AddSeries.Request
    ) -> AddSeries.Response:
        return AddSeries.Response(id=self.series_manager.add_series(request.name))

    @api("user")
    async def remove_series(
        self, user: User, request: RemoveSeries.Request
    ) -> RemoveSeries.Response:
        self.series_manager.remove_series(request.id)
        return RemoveSeries.Response()

    @api("user")
    async def update_series_tvs(
        self, user: User, request: UpdateSeriesTVs.Request
    ) -> UpdateSeriesTVs.Response:
        self.series_manager.update_series_tvs(request.id, request.tvs)
        return UpdateSeriesTVs.Response()

    @api("user")
    async def get_series(
        self, user: User, request: GetSeries.Request
    ) -> GetSeries.Response:
        if request.ids is not None:
            return GetSeries.Response(
                series=[self.series_manager.get_series_by_id(id) for id in request.ids]
            )
        else:
            return GetSeries.Response(series=self.series_manager.get_series())

    @api("user")
    async def set_watch_progress(
        self, user: User, request: SetWatchProgress.Request
    ) -> SetWatchProgress.Response:
        self.user_data_manager.set_watch_progress(
            user.username, request.tv_id, request.episode_id, request.time
        )
        return SetWatchProgress.Response()

    @api("user")
    async def set_tv_tag(
        self, user: User, request: SetTVTag.Request
    ) -> SetTVTag.Response:
        self.user_data_manager.set_tv_tag(user.username, request.tv_id, request.tag)
        return SetTVTag.Response()
