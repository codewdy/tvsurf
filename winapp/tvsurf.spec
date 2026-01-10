# -*- mode: python ; coding: utf-8 -*-

import json
config = json.load(open("build.json"))

a = Analysis(
    ['main.py'],
    pathex=['..'],
    binaries=[
    ],
    datas=[
        (config["ffmpeg"], 'ffmpeg'),
        (config["chrome-win64"], 'chrome-win64'),
        ("../test-web/build/client", "web"),
        ("../service/searcher.json", "searcher"),
        ("icon.ico", "assets"),
        ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    icon="icon.ico",
    exclude_binaries=True,
    name='tvsurf',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='tvsurf',
)
