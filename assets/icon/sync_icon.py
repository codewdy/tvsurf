import shutil
import os


def copy_file(src, dst):
    shutil.copy(src, dst)


def icon_48_ico():
    return os.path.join(os.path.dirname(__file__), "icon_48.ico")


def icon_1024_png():
    return os.path.join(os.path.dirname(__file__), "icon_1024.png")


def icon_mac_tray_44_png():
    return os.path.join(os.path.dirname(__file__), "mac_tray_44.png")


def web_icon():
    return os.path.join(
        os.path.dirname(__file__), "..", "..", "web", "public", "favicon.ico"
    )


def winapp_icon():
    return os.path.join(os.path.dirname(__file__), "..", "..", "winapp", "icon.ico")


def winapp_mac_tray_icon():
    return os.path.join(os.path.dirname(__file__), "..", "..", "winapp", "mac_icon.ico")


def app_icon():
    return os.path.join(
        os.path.dirname(__file__), "..", "..", "app", "assets", "icon.png"
    )


if __name__ == "__main__":
    copy_file(icon_48_ico(), web_icon())
    copy_file(icon_48_ico(), winapp_icon())
    copy_file(icon_1024_png(), app_icon())
    copy_file(icon_mac_tray_44_png(), winapp_mac_tray_icon())
