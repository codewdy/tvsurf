from typing import Callable, Type
from service.schema.dtype import BaseModel
import os
from service.lib.context import Context
import asyncio


class DBUnit:
    def __init__(self, filename: str, model: Type[BaseModel]) -> None:
        self.filename = filename
        if os.path.exists(filename):
            with open(filename, "r", encoding="utf-8") as f:
                self.data = model.model_validate_json(f.read())
        else:
            self.data = model()
            with open(filename, "w", encoding="utf-8") as f:
                f.write(self.data.model_dump_json(indent=2))
        self.dirty = False
        self.data._commit = self.commit

    def commit(self) -> None:
        self.dirty = True

    def save(self) -> None:
        if self.dirty:
            with open(self.filename, "w", encoding="utf-8") as f:
                f.write(self.data.model_dump_json(indent=2))
            self.dirty = False


class DB:
    def __init__(self) -> None:
        self.units: dict[str, DBUnit] = {}

    def start(self) -> None:
        self.dir = os.path.join(Context.config.data_dir, "db")
        os.makedirs(self.dir, exist_ok=True)
        self.save_interval = Context.config.db.save_interval
        self.save_task = asyncio.create_task(self._save_loop())

    def stop(self) -> None:
        self.save()
        self.save_task.cancel()

    async def _save_loop(self) -> None:
        while True:
            await asyncio.sleep(self.save_interval.total_seconds())
            self.save()

    def manage(self, name: str, model: Type[BaseModel]) -> BaseModel:
        if name in self.units:
            return self.units[name].data
        filename = os.path.join(self.dir, name + ".json")
        if filename not in self.units:
            self.units[name] = DBUnit(filename, model)
        return self.units[name].data

    def save(self) -> None:
        for unit in self.units.values():
            unit.save()
