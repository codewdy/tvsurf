# NAS or Linux with Docker

## 推荐：docker compose

使用 docker compose，需要创建 `docker-compose.yml` 文件：

注意:请仔细阅读其中的注释，选择你觉得合适的方式安装。同时，推荐修改镜像到南京大学的镜像站（即注释掉的那行）。

```yaml
version: '3.8'

services:
  tvsurf:
    image: ghcr.io/codewdy/tvsurf:latest
    # 如果上面的镜像太慢，也可以选择国内的镜像站：
    # image: ghcr.nju.edu.cn/codewdy/tvsurf:latest

    container_name: tvsurf

    # 设置容器运行的用户ID和组ID，确保文件权限正确
    # 在 NAS 系统中，通常需要设置为 NAS 用户的 UID/GID
    # 如果不设置，将使用 root 用户运行（PUID=0, PGID=0）
    environment:
      - PUID=${UID:-0}
      - PGID=${GID:-0}

    # 修改 /path/to/data-dir 到你像保存的数据文件夹
    volumes:
      - /path/to/data-dir:/app/tvsurf/data

    # 修改第一个 9399 为你希望启动服务的端口
    ports:
      - "9399:9399"
    restart: unless-stopped
```

然后执行：

```shell
# 在 Linux 系统中，自动获取当前用户的 UID 和 GID（可选）
# 如果不设置，容器将使用 root 用户运行
export UID=$(id -u)
export GID=$(id -g)
docker compose up -d
```

这将启动一个后台 docker 进程，在 9399 端口启动服务，把数据存储在 /path/to/data-dir 目录里。

此时访问对应的端口，应该会弹出如下界面：

![系统设置](/doc/image/system-setup.png)

推荐使用用户名密码模式，因为很多 nas 可能会对外网暴露端口，使用单用户模式将把所有信息不加密地暴露在外网上。

## 使用 docker 命令（不推荐）

也可以直接使用 docker run 启动镜像

```shell
export DATA_DIR=/path/to/data-dir
export PORT=9399
docker run -d -e PUID=$(id -u ${USER}) -e PGID=$(id -g ${USER}) -v ${DATA_DIR}:/app/tvsurf/data -p ${PORT}:9399 -ti ghcr.io/codewdy/tvsurf:latest
# 如果上面的太慢，也可以选择国内的镜像站：
# docker run -d -e PUID=${PUID} -e PGID=${PGID} -v ${DATA_DIR}:/app/tvsurf/data -p ${PORT}:9399 -ti ghcr.nju.edu.cn/codewdy/tvsurf:latest
 ```
