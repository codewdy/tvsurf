import logging
import logging.handlers
from typing import Optional


def get_logger(
    level: int, filename: Optional[str] = None, rotate_day: int = 7
) -> logging.Logger:
    logger = logging.getLogger("tv-track")
    logger.setLevel(level)
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    if filename:
        handler = logging.handlers.TimedRotatingFileHandler(
            filename, when="midnight", backupCount=rotate_day
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    else:
        handler = logging.StreamHandler()
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger
