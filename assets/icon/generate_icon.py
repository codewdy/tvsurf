#!/usr/bin/env python3
"""
生成 tvsurf 图标
生成 1024x1024 PNG 和 48x48 ICO 格式
"""

from PIL import Image, ImageDraw, ImageFont
import os


def generate_icon():
    # 创建 1024x1024 的 PNG 图标
    size = 1024
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 从中心辐射的渐变（中心紫色到外围白色）
    center_x, center_y = size // 2, size // 2
    max_distance = (center_x**2 + center_y**2) ** 0.5  # 最大距离（从中心到角落）

    # 中心紫色 RGB (128, 0, 128) 或 (147, 51, 234)
    center_r, center_g, center_b = 147, 51, 234
    # 外围白色 RGB (255, 255, 255)
    outer_r, outer_g, outer_b = 255, 255, 255

    # 逐像素绘制径向渐变
    pixels = img.load()
    for y in range(size):
        for x in range(size):
            # 计算到中心的距离
            dx = x - center_x
            dy = y - center_y
            distance = (dx**2 + dy**2) ** 0.5

            # 计算渐变进度（0到1，0为中心，1为最外围）
            progress = min(distance / max_distance, 1.0)

            # 根据进度插值颜色
            r = int(center_r + progress * (outer_r - center_r))
            g = int(center_g + progress * (outer_g - center_g))
            b = int(center_b + progress * (outer_b - center_b))

            pixels[x, y] = (r, g, b, 255)

    # 尝试加载中文字体
    font_size = int(size * 0.6)  # 字体大小约为图标大小的60%
    font = None

    # 优先使用中文字体路径（按优先级排序）
    font_paths = [
        # Linux - Noto Sans CJK（优先使用粗体，显示效果更好）
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc",
        # Linux - AR PL 字体
        "/usr/share/fonts/truetype/arphic/uming.ttc",
        "/usr/share/fonts/truetype/arphic/ukai.ttc",
        # macOS
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        # Windows
        "C:/Windows/Fonts/msyh.ttc",  # 微软雅黑
        "C:/Windows/Fonts/simhei.ttf",  # 黑体
        "C:/Windows/Fonts/simsun.ttc",  # 宋体
    ]

    for font_path in font_paths:
        try:
            if os.path.exists(font_path):
                font = ImageFont.truetype(font_path, font_size)
                print(f"使用字体: {font_path}")
                break
        except Exception as e:
            continue

    # 如果找不到字体，尝试使用 fontconfig 查找
    if font is None:
        try:
            import subprocess

            # 使用 fc-match 查找中文字体
            result = subprocess.run(
                ["fc-match", "-f", "%{file}", "Noto Sans CJK SC:style=Bold"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if result.returncode == 0 and result.stdout.strip():
                font_path = result.stdout.strip()
                if os.path.exists(font_path):
                    font = ImageFont.truetype(font_path, font_size)
                    print(f"使用字体: {font_path}")
        except:
            pass

    # 如果还是找不到，报错
    if font is None:
        raise Exception("未找到中文字体，请安装 Noto Sans CJK 或 AR PL 字体")

    # 绘制"追"字
    text = "追"
    # 获取文字边界框
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # 计算居中位置
    x = (size - text_width) // 2 - bbox[0]
    y = (size - text_height) // 2 - bbox[1]

    # 绘制文字（白色，无阴影）
    draw.text((x, y), text, font=font, fill=(255, 255, 255, 255))

    # 保存 1024x1024 PNG
    png_path = os.path.join(os.path.dirname(__file__), "icon_1024.png")
    img.save(png_path, "PNG")
    print(f"已生成: {png_path}")

    # 创建 48x48 的 ICO 图标
    ico_size = 48
    ico_img = img.resize((ico_size, ico_size), Image.Resampling.LANCZOS)
    ico_path = os.path.join(os.path.dirname(__file__), "icon_48.ico")
    ico_img.save(ico_path, "ICO", sizes=[(ico_size, ico_size)])
    print(f"已生成: {ico_path}")


if __name__ == "__main__":
    try:
        generate_icon()
        print("图标生成完成！")
    except ImportError:
        print("错误: 需要安装 Pillow 库")
        print("请运行: pip install Pillow")
    except Exception as e:
        print(f"生成图标时出错: {e}")
