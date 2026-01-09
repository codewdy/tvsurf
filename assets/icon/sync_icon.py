import shutil
import os


def copy_file(src, dst):
    shutil.copy(src, dst)


def icon_48_ico():
    return os.path.join(os.path.dirname(__file__), "icon_48.ico")


def icon_1024_png():
    return os.path.join(os.path.dirname(__file__), "icon_1024.png")


def test_web_icon():
    return os.path.join(
        os.path.dirname(__file__), "..", "..", "test-web", "public", "favicon.ico"
    )


def winapp_icon():
    return os.path.join(os.path.dirname(__file__), "..", "..", "winapp", "icon.ico")


if __name__ == "__main__":
    copy_file(icon_48_ico(), test_web_icon())
    copy_file(icon_48_ico(), winapp_icon())
