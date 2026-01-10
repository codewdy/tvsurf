#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
构建向导脚本
用于生成 build.json 并执行 pyinstaller 打包
"""

import os
import json
import subprocess
import sys
from pathlib import Path
import shutil
import zipfile


def zip_dir(dirname: str, zipfilename: str):
    filelist = []
    if os.path.isfile(dirname):
        filelist.append(dirname)
    else:
        for root, dirs, files in os.walk(dirname):
            for name in files:
                filelist.append(os.path.join(root, name))

    zf = zipfile.ZipFile(zipfilename, "w", zipfile.ZIP_DEFLATED)
    for tar in filelist:
        arcname = "tvsurf/" + tar[len(dirname) :]
        zf.write(tar, arcname)
    zf.close()


def get_script_dir():
    """获取脚本所在目录"""
    return Path(__file__).parent.absolute()


def load_example_config():
    """加载示例配置文件"""
    script_dir = get_script_dir()
    example_path = script_dir / "build.example.json"

    if not example_path.exists():
        print(f"错误: 找不到 {example_path}")
        sys.exit(1)

    with open(example_path, "r", encoding="utf-8") as f:
        return json.load(f)


def check_and_create_build_json():
    """检查 build.json 是否存在，如果不存在则创建"""
    script_dir = get_script_dir()
    build_json_path = script_dir / "build.json"

    if build_json_path.exists():
        print(f"✓ build.json 已存在: {build_json_path}")
        with open(build_json_path, "r", encoding="utf-8") as f:
            config = json.load(f)
            print(f"  当前配置:")
            for key, value in config.items():
                print(f"    {key}: {value}")
        return

    print("build.json 不存在，开始创建...")
    example_config = load_example_config()

    config = {}
    print("\n请输入以下配置:")

    for key, example_value in example_config.items():
        prompt = f"{key} [{example_value}]: "
        value = input(prompt).strip()

        if not value:
            value = example_value

        config[key] = value

    # 保存 build.json
    with open(build_json_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=4, ensure_ascii=False)

    print(f"\n✓ build.json 已创建: {build_json_path}")
    print(f"  配置内容:")
    for key, value in config.items():
        print(f"    {key}: {value}")


def install_dependencies():
    """安装依赖"""
    script_dir = get_script_dir()
    os.chdir(script_dir)
    subprocess.run(["pip", "install", "-r", "../service/requirements.txt"], check=True)
    subprocess.run(["pip", "install", "-r", "requirements.txt"], check=True)


def run_pyinstaller():
    """执行 pyinstaller 命令"""
    script_dir = get_script_dir()

    # 切换到 winapp 目录
    original_dir = os.getcwd()
    os.chdir(script_dir)

    try:
        print(f"\n切换到目录: {script_dir}")
        spec_file = "tvsurf.spec"
        print(f"执行: pyinstaller {spec_file} --noconfirm\n")

        # 执行 pyinstaller
        result = subprocess.run(
            ["pyinstaller", spec_file, "--noconfirm"], check=True, cwd=str(script_dir)
        )

        # 复制 config.yaml 到 dist 目录
        config_path = script_dir / ".." / "config.yaml"
        dist_dir = script_dir / "dist" / "tvsurf"
        shutil.copy(config_path, dist_dir)

        print("\n✓ 打包完成!")

    except subprocess.CalledProcessError as e:
        print(f"\n✗ 打包失败: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print("\n✗ 错误: 找不到 pyinstaller 命令")
        print("  请确保已安装 pyinstaller: pip install pyinstaller")
        sys.exit(1)
    finally:
        # 恢复原始目录
        os.chdir(original_dir)


def copy_config_to_dist():
    """复制 config.yaml 到 dist 目录"""
    script_dir = get_script_dir()
    config_path = script_dir / ".." / "config.yaml"
    dist_dir = script_dir / "dist" / "tvsurf"
    shutil.copy(config_path, dist_dir)


def zip_dist():
    """压缩 dist 目录"""
    print("\n 压缩中...")
    script_dir = get_script_dir()
    dist_dir = script_dir / "dist" / "tvsurf"
    zip_dir(str(dist_dir), str(script_dir / "dist" / "tvsurf.zip"))
    print("\n 压缩完成!")


def main():
    """主函数"""
    print("=" * 60)
    print("TVSurf 构建向导")
    print("=" * 60)

    # 检查并创建 build.json
    check_and_create_build_json()

    # 安装依赖
    install_dependencies()

    # 执行 pyinstaller
    run_pyinstaller()

    # 复制 config.yaml 到 dist 目录
    copy_config_to_dist()

    # 压缩 dist 目录
    zip_dist()


if __name__ == "__main__":
    main()
