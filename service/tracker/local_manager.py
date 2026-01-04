from service.lib.context import Context
from service.schema.tvdb import TVDB, Source, TV, Storage, TrackStatus
from datetime import datetime


class LocalManager:
    def start(self):
        self.tvdb: TVDB = Context.data("db").manage("tvdb", TVDB)

    async def add_tv(self, name: str, source: Source):
        id = self.tvdb.new_tv_id
        self.tvdb.new_tv_id += 1
        self.tvdb.tvs[id] = TV(
            name=name,
            source=source,
            storage=Storage(directory="", episodes=[], cover=""),
            track=TrackStatus(tracking=False, latest_update=datetime.now()),
            albums=[],
        )
        self.tvdb.commit()
        return id
