from service.schema.user_data import UserData, UserTVData, Tag, WatchProgress
from service.lib.context import Context
from datetime import datetime


class UserDataManager:
    def get_user_data(self, user_name: str) -> UserData:
        return Context.data("db").manage(f"user_data_db_{user_name}", UserData)

    def get_user_tv_data(self, user_data: UserData, tv_id: int) -> UserTVData:
        if user_data.tvs.get(tv_id) is None:
            user_data.tvs[tv_id] = UserTVData(
                tv_id=tv_id,
                tag=Tag.NOT_TAGGED,
                watch_progress=WatchProgress(episode_id=0, time=0),
                last_update=datetime.min,
            )
            user_data.commit()
        return user_data.tvs[tv_id]

    def set_watch_progress(
        self, user_name: str, tv_id: int, episode_id: int, time: float
    ) -> None:
        user_data = self.get_user_data(user_name)
        tv_watch = self.get_user_tv_data(user_data, tv_id)
        tv_watch.watch_progress = WatchProgress(episode_id=episode_id, time=time)
        tv_watch.last_update = datetime.now()
        user_data.commit()

    def set_tv_tag(self, user_name: str, tv_id: int, tag: Tag) -> None:
        user_data = self.get_user_data(user_name)
        tv_watch = self.get_user_tv_data(user_data, tv_id)
        tv_watch.tag = tag
        user_data.commit()
