# 在飞牛os安装 tvsurf

### 创建 docker compose

在 docker 里选择 Compose，新建项目，并把下面的 compose 文件填入：

注意：请仔细阅读下面的文件中的注释，确保符合你的预期。同时，推荐修改镜像到南京大学的镜像站（即注释掉的那行）。

```yaml
version: '3.8'

services:
  tvsurf:
    image: ghcr.io/codewdy/tvsurf:latest
    # 如果上面的镜像太慢，也可以选择国内的镜像站：
    # image: ghcr.nju.edu.cn/codewdy/tvsurf:latest

    container_name: tvsurf

    # 设置容器运行的用户ID和组ID，确保文件权限正确
    # 飞牛 OS 默认的第一个用户的 UID 是 1000，users 组的 id 是 1001
    # 也可以修改为你的用户的 id
    # 在 ssh 终端输入"id -a" 以获取对应的uid/gid
    environment:
      - PUID=1000
      - PGID=1001

    # 存在项目路径下，如果想换路径，修改冒号前面的部分
    volumes:
      - .:/app/tvsurf/data

    # 修改第一个 9399 为你希望启动服务的端口
    ports:
      - "9399:9399"
    restart: unless-stopped
```

![docker](/doc/image/fnos/docker.png)

![docker-create](/doc/image/fnos/docker-create.png)


### 安装成功

当出现以下界面的时候说明安装成功：

![安装成功](/doc/image/fnos/install-ok.png)

然后你可以访问你服务器的对应端口（在默认配置里是9399）来访问服务。

![系统设置](/doc/image/system-setup.png)

推荐使用用户名密码模式，因为你的 nas 可能会对外网暴露端口，使用单用户模式将把所有信息不加密地暴露在外网上。