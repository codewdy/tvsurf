import asyncio
from typing import Awaitable, Callable


class ParallelHolder:
    def __init__(self, max_concurrent: int):
        self.max_concurrent = max_concurrent
        self.events: dict[int, asyncio.Event] = {}
        self.tasks: dict[int, asyncio.Task] = {}
        self.running_tasks: set[int] = set()
        self.id_counter = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        for task in self.tasks.values():
            task.cancel()
        await asyncio.gather(*self.tasks.values(), return_exceptions=True)

    async def wait_all(self):
        return await asyncio.gather(*self.tasks.values())

    def schedule_task(self):
        if len(self.running_tasks) >= self.max_concurrent:
            return
        for id in sorted(self.events.keys()):
            if id in self.running_tasks:
                continue
            self.running_tasks.add(id)
            self.events[id].set()
            if len(self.running_tasks) >= self.max_concurrent:
                break

    def callback(self, id: int):
        self.events.pop(id)
        self.tasks.pop(id)
        if id in self.running_tasks:
            self.running_tasks.remove(id)
        self.schedule_task()

    def schedule(self, coro: Callable[[], Awaitable]):
        id = self.id_counter
        self.id_counter += 1
        event = asyncio.Event()
        self.events[id] = event

        async def task_wrapper():
            await event.wait()
            await coro()

        task = asyncio.create_task(task_wrapper())
        self.tasks[id] = task
        task.add_done_callback(lambda _: self.callback(id))
        self.schedule_task()
        return task
