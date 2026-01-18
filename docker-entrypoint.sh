#!/bin/bash
set -e

# 设置默认值，如果未提供 PUID/PGID 则使用 root (0)
PUID=${PUID:-0}
PGID=${PGID:-0}

# 如果不是 root (0)，则创建或修改用户
if [ "$PUID" != "0" ] || [ "$PGID" != "0" ]; then
    # 如果组不存在，创建组
    if ! getent group "$PGID" > /dev/null 2>&1; then
        groupadd -g "$PGID" -o tvsurf 2>/dev/null || true
    fi
    
    # 如果用户不存在，创建用户
    if ! id -u "$PUID" > /dev/null 2>&1; then
        useradd -u "$PUID" -g "$PGID" -o -m -s /bin/bash tvsurf 2>/dev/null || true
    fi
    
    # 确保应用目录的权限正确
    chown -R "$PUID:$PGID" /app/tvsurf 2>/dev/null || true
    
    # 切换到指定用户执行命令
    exec gosu "$PUID:$PGID" "$@"
else
    # 如果 PUID/PGID 为 0，直接以 root 运行
    exec "$@"
fi
