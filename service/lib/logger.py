import logging
import logging.handlers


def get_logger(level, filename=None, rotate_day=7):
    logger = logging.getLogger("tv-track")
    logger.setLevel(level)
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    if filename:
        handler = logging.handlers.TimedRotatingFileHandler(
            filename, when='midnight', backupCount=rotate_day)
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    else:
        handler = logging.StreamHandler()
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger
