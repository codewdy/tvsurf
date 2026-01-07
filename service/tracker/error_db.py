from service.lib.context import Context
from service.schema.error import ErrorDB as ErrorDBSchema
from service.schema.error import Error, ErrorType
from datetime import datetime


class ErrorDB:
    async def start(self):
        self.error_db = Context.data("db").manage("error_db", ErrorDBSchema)
        Context.error_handler.add_handler("error", self.handle_error)
        Context.error_handler.add_handler("critical", self.handle_critical_error)

    def handle_error(self, title: str, error: str):
        self.error_db.errors.append(
            Error(
                id=self.error_db.next_error_id,
                timestamp=datetime.now(),
                title=title,
                description=error,
                type=ErrorType.ERROR,
            )
        )
        self.error_db.next_error_id += 1
        self.error_db.commit()

    def handle_critical_error(self, title: str, error: str):
        self.error_db.errors.append(
            Error(
                id=self.error_db.next_error_id,
                timestamp=datetime.now(),
                title=title,
                description=error,
                type=ErrorType.CRITICAL,
            )
        )
        self.error_db.next_error_id += 1
        self.error_db.commit()

    def get_errors(self) -> list[Error]:
        return self.error_db.errors

    def remove_errors(self, ids: list[int]):
        self.error_db.errors = [
            error for error in self.error_db.errors if error.id not in ids
        ]
        self.error_db.commit()
