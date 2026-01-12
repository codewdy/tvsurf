from service.lib.context import Context
from service.schema.tvdb import Series, TVDB
from datetime import datetime


class SeriesManager:
    async def start(self) -> None:
        self.tvdb: TVDB = Context.data("db").manage("tvdb", TVDB)

    def update_series_tvs(self, id: int, tvs: list[int]) -> None:
        original_tvs = list(self.tvdb.series[id].tvs)
        for tv_id in original_tvs:
            if tv_id not in tvs:
                self.tvdb.tvs[tv_id].series.remove(id)
        for tv_id in tvs:
            if tv_id not in original_tvs:
                self.tvdb.tvs[tv_id].series.append(id)
        self.tvdb.series[id].tvs = tvs
        self.tvdb.series[id].last_update = datetime.now()
        self.tvdb.commit()

    def add_series(self, name: str) -> int:
        for existing_series in self.tvdb.series.values():
            if existing_series.name == name:
                raise ValueError(f"系列名称 '{name}' 已存在")

        id = self.tvdb.new_series_id
        self.tvdb.new_series_id += 1
        self.tvdb.series[id] = Series(
            id=id, name=name, tvs=[], last_update=datetime.now()
        )
        self.tvdb.commit()
        return id

    def remove_series(self, id: int) -> None:
        self.update_series_tvs(id, [])
        del self.tvdb.series[id]
        self.tvdb.commit()

    def get_series(self) -> list[Series]:
        return list(self.tvdb.series.values())

    def get_series_by_id(self, id: int) -> Series:
        return self.tvdb.series[id]

    def add_tv_to_series(self, tv_id: int, series_id: list[int]) -> None:
        for sid in series_id:
            self.tvdb.series[sid].tvs.append(tv_id)
            self.tvdb.series[sid].last_update = datetime.now()
        self.tvdb.tvs[tv_id].series.extend(series_id)
        self.tvdb.commit()

    def remove_tv_from_series(self, tv_id: int) -> None:
        for sid in self.tvdb.tvs[tv_id].series:
            self.tvdb.series[sid].tvs.remove(tv_id)
            self.tvdb.series[sid].last_update = datetime.now()
        self.tvdb.tvs[tv_id].series = []
        self.tvdb.commit()
