from service.lib.context import Context
from service.schema.error import ErrorDB as ErrorDBSchema
from service.schema.error import Error, ErrorType
from datetime import datetime, timezone


class ErrorDB:
    async def start(self) -> None:
        self.error_db = Context.data("db").manage("error_db", ErrorDBSchema)
        Context.error_handler.add_handler("error", self.handle_error)
        Context.error_handler.add_handler("critical", self.handle_critical_error)
        Context.error_handler.set_ignore_error_handler(
            self.ignore_error_counter, self.clear_ignore_error_counter
        )

    def handle_error(self, title: str, error: str) -> None:
        self.error_db.errors.append(
            Error(
                id=self.error_db.next_error_id,
                timestamp=datetime.now(timezone.utc),
                title=title,
                description=error,
                type=ErrorType.ERROR,
            )
        )
        self.error_db.next_error_id += 1
        self.error_db.commit()

    def handle_critical_error(self, title: str, error: str) -> None:
        self.error_db.errors.append(
            Error(
                id=self.error_db.next_error_id,
                timestamp=datetime.now(timezone.utc),
                title=title,
                description=error,
                type=ErrorType.CRITICAL,
            )
        )
        self.error_db.next_error_id += 1
        self.error_db.commit()

    def get_errors(self) -> list[Error]:
        return self.error_db.errors

    def remove_errors(self, ids: list[int]) -> None:
        self.error_db.errors = [
            error for error in self.error_db.errors if error.id not in ids
        ]
        self.error_db.commit()

    def ignore_error_counter(self, key: str) -> int:
        self.error_db.ignored_errors.count[key] = (
            self.error_db.ignored_errors.count.get(key, 0) + 1
        )
        self.error_db.commit()
        return self.error_db.ignored_errors.count[key]

    def clear_ignore_error_counter(self, key: str) -> None:
        if key in self.error_db.ignored_errors.count:
            del self.error_db.ignored_errors.count[key]
            self.error_db.commit()

    def get_error_count(self) -> int:
        return len(self.error_db.errors)
