# -*- mode: python ; coding: utf-8 -*-

winapp = Analysis(
    ['../../winapp/main.py'],
    pathex=['../..'],
    binaries=[
    ],
    datas=[
        ("../../deps", "deps"),
        ("../../web/build/client", "web"),
        ("../../service/searcher.json", "searcher"),
        ("../../winapp/icon.ico", "assets"),
        ("../../winapp/mac_icon.ico", "assets"),
        ("../../config.yaml", "assets"),
        ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
winapp_pyz = PYZ(winapp.pure)

winapp_exe = EXE(
    winapp_pyz,
    winapp.scripts,
    [],
    icon="../../winapp/icon.ico",
    exclude_binaries=True,
    name='tvsurf',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    winapp_exe,
    winapp.binaries,
    winapp.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='tvsurf',
)

app = BUNDLE(
    coll,
    name='tvsurf.app',
    icon='../../winapp/icon.icns',
    bundle_identifier='com.codewdy.tvsurf',
    info_plist={"LSBackgroundOnly":True},
)
