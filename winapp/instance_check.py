import filelock
import os
import sys


def default_lock_path():
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(os.path.dirname(sys.argv[0]), "instance.lock")
    else:
        return "instance.lock"


_LOCK = filelock.FileLock(default_lock_path())


def check_single_instance() -> bool:
    try:
        _LOCK_INSTANCE = _LOCK.acquire(blocking=False)
        return False
    except filelock.Timeout:
        return True


def release_instance_check():
    _LOCK.release()
