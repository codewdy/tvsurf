from typing import Callable, Type
from service.schema.dtype import BaseModel
import os
from service.lib.context import Context
import asyncio


class DBUnit:
    def __init__(self, filename: str, model: Type[BaseModel]):
        self.filename = filename
        if os.path.exists(filename):
            with open(filename, "r") as f:
                self.data = model.model_validate_json(f.read())
        else:
            self.data = model()
            with open(filename, "w") as f:
                f.write(self.data.model_dump_json(indent=2))
        self.dirty = False
        self.data._commit = self.commit

    def commit(self):
        self.dirty = True

    def save(self):
        if self.dirty:
            with open(self.filename, "w") as f:
                f.write(self.data.model_dump_json(indent=2))
            self.dirty = False


class DB:
    def __init__(self):
        self.units = {}

    def start(self):
        self.dir = os.path.join(Context.config.data_dir, "db")
        os.makedirs(self.dir, exist_ok=True)
        self.save_interval = Context.config.db.save_interval
        self.save_task = asyncio.create_task(self._save_loop())

    def stop(self):
        self.save()
        self.save_task.cancel()

    async def _save_loop(self):
        while True:
            await asyncio.sleep(self.save_interval.total_seconds())
            self.save()

    def manage(self, name: str, model: Type[BaseModel]):
        filename = os.path.join(self.dir, name + ".json")
        if filename not in self.units:
            self.units[name] = DBUnit(filename, model)
        return self.units[name].data

    def save(self):
        for unit in self.units.values():
            unit.save()
