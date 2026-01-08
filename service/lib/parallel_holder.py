import asyncio
from typing import Awaitable, Callable, Any, Optional


class ParallelHolder:
    def __init__(self, max_concurrent: int) -> None:
        self.max_concurrent = max_concurrent
        self.events: dict[int, asyncio.Event] = {}
        self.tasks: dict[int, asyncio.Task[Any]] = {}
        self.running_tasks: set[int] = set()
        self.id_counter = 0

    async def __aenter__(self) -> "ParallelHolder":
        return self

    async def __aexit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc_value: Optional[BaseException],
        traceback: Any,
    ) -> None:
        for task in self.tasks.values():
            task.cancel()
        await asyncio.gather(*self.tasks.values(), return_exceptions=True)

    async def wait_all(self) -> list[Any]:
        return await asyncio.gather(*self.tasks.values())

    def schedule_task(self) -> None:
        if len(self.running_tasks) >= self.max_concurrent:
            return
        for id in sorted(self.events.keys()):
            if id in self.running_tasks:
                continue
            self.running_tasks.add(id)
            self.events[id].set()
            if len(self.running_tasks) >= self.max_concurrent:
                break

    def callback(self, id: int) -> None:
        self.events.pop(id)
        self.tasks.pop(id)
        if id in self.running_tasks:
            self.running_tasks.remove(id)
        self.schedule_task()

    def schedule(self, coro: Callable[[], Awaitable[Any]]) -> asyncio.Task[Any]:
        id = self.id_counter
        self.id_counter += 1
        event = asyncio.Event()
        self.events[id] = event

        async def task_wrapper() -> Any:
            await event.wait()
            return await coro()

        task = asyncio.create_task(task_wrapper())
        self.tasks[id] = task
        task.add_done_callback(lambda _: self.callback(id))
        self.schedule_task()
        return task
