from service.lib.context import Context
from service.schema.tvdb import Album, TVDB


class AlbumManager:
    async def start(self) -> None:
        self.tvdb: TVDB = Context.data("db").manage("tvdb", TVDB)

    def update_album_tvs(self, id: int, tvs: list[int]) -> None:
        original_tvs = list(self.tvdb.albums[id].tvs)
        for tv_id in original_tvs:
            if tv_id not in tvs:
                self.tvdb.tvs[tv_id].albums.remove(id)
        for tv_id in tvs:
            if tv_id not in original_tvs:
                self.tvdb.tvs[tv_id].albums.append(id)
        self.tvdb.albums[id].tvs = tvs
        self.tvdb.commit()

    def add_album(self, name: str) -> int:
        id = self.tvdb.new_album_id
        self.tvdb.new_album_id += 1
        self.tvdb.albums[id] = Album(id=id, name=name, tvs=[])
        self.tvdb.commit()
        return id

    def remove_album(self, id: int) -> None:
        self.update_album_tvs(id, [])
        del self.tvdb.albums[id]
        self.tvdb.commit()

    def get_albums(self) -> list[Album]:
        return list(self.tvdb.albums.values())

    def get_album(self, id: int) -> Album:
        return self.tvdb.albums[id]
