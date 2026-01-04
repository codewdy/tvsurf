from service.schema.downloader import DownloadProgress


def format_bytes(bytes: float) -> str:
    """将字节数转换为人类可读的格式"""
    if bytes == 0:
        return "0 B"

    units = ["B", "KB", "MB", "GB", "TB"]
    unit_index = 0
    size = abs(bytes)

    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1

    # 保留2位小数，但如果整数部分足够大则只保留1位
    if size >= 100:
        return f"{size:.1f} {units[unit_index]}"
    elif size >= 10:
        return f"{size:.2f} {units[unit_index]}"
    else:
        return f"{size:.2f} {units[unit_index]}"


def format_speed(bytes_per_second: float) -> str:
    """将速度（字节/秒）转换为人类可读的格式"""
    if bytes_per_second == 0:
        return "0 B/s"

    return f"{format_bytes(bytes_per_second)}/s"


def format_time(seconds: float) -> str:
    """将秒数转换为人类可读的时间格式"""
    if seconds < 0 or not (seconds < float("inf")):
        return "未知"

    if seconds < 60:
        return f"{int(seconds)}秒"

    minutes = int(seconds // 60)
    secs = int(seconds % 60)

    if minutes < 60:
        return f"{minutes}分{secs}秒"

    hours = minutes // 60
    minutes = minutes % 60
    return f"{hours}小时{minutes}分{secs}秒"


def human_readable_progress(progress: DownloadProgress) -> str:
    """
    将下载进度转换为人类可读的字符串格式

    Args:
        progress: DownloadProgress 对象

    Returns:
        人类可读的进度字符串，例如：
        "下载中: 1.5 MB / 10.0 MB (15.0%) - 500 KB/s - 剩余 17秒"
    """
    if not progress.downloading:
        return progress.status
    status = progress.status
    downloaded = format_bytes(progress.downloaded_size)
    total = format_bytes(progress.total_size)
    speed = format_speed(progress.speed)

    # 计算百分比
    if progress.total_size > 0:
        percentage = (progress.downloaded_size / progress.total_size) * 100
        percentage_str = f"{percentage:.1f}%"
    else:
        percentage_str = "未知"

    # 计算剩余时间
    remaining_time_str = ""
    if progress.speed > 0 and progress.total_size > 0:
        remaining_bytes = progress.total_size - progress.downloaded_size
        if remaining_bytes > 0:
            remaining_seconds = remaining_bytes / progress.speed
            remaining_time_str = f" - 剩余 {format_time(remaining_seconds)}"

    # 组装字符串
    if progress.total_size > 0:
        return f"{status}: {downloaded} / {total} ({percentage_str}) - {speed}{remaining_time_str}"
    else:
        return f"{status}: {downloaded} - {speed}"
