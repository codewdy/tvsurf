FROM ubuntu:24.04

# 设置环境变量，避免交互式安装
ENV DEBIAN_FRONTEND=noninteractive

# 设置 PUID 和 PGID 环境变量，默认值为 0 (root)
# 用户可以通过 docker run -e PUID=1000 -e PGID=1000 来覆盖
ENV PUID=0
ENV PGID=0

# 创建工作目录
WORKDIR /app

RUN apt-get update && apt-get install -y \
    libxcb1 \
    libdrm-dev \
    libnss3 \
    fontconfig \
    fonts-dejavu-core \
    gosu \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 复制构建产物（构建上下文会根据平台准备对应的 dist/tvsurf 目录）
COPY dist/tvsurf /app/tvsurf

# 复制配置文件
COPY config.docker.yaml /app/tvsurf/config.yaml

# 复制 entrypoint 脚本
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# 设置可执行权限
RUN chmod +x /app/tvsurf/tvsurf \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

# 暴露端口（如果需要，根据实际应用调整）
EXPOSE 9399

# 设置工作目录为应用目录
WORKDIR /app/tvsurf

# 使用 entrypoint 脚本运行应用
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh", "./tvsurf"]
