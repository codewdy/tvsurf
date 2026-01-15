FROM ubuntu:24.04

# 设置环境变量，避免交互式安装
ENV DEBIAN_FRONTEND=noninteractive

# 创建工作目录
WORKDIR /app

# 复制构建产物（构建上下文会根据平台准备对应的 dist/tvsurf 目录）
COPY dist/tvsurf /app/tvsurf

# 复制配置文件
COPY config.docker.yaml /app/tvsurf/config.yaml

# 设置可执行权限
RUN chmod +x /app/tvsurf/tvsurf

# 暴露端口（如果需要，根据实际应用调整）
EXPOSE 9399

# 设置工作目录为应用目录
WORKDIR /app/tvsurf

# 运行应用
ENTRYPOINT ["./tvsurf"]
