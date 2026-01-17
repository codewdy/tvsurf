# 群晖安装 tvsurf

打开 Container Manager（默认在套件中心），然后点击项目，点击新增

![新增项目](/doc/image/synology/new-docker-compose.png)

然后选择你想要保存数据的路径，然后选择创建 docker compose.yml，填入我们准备好的 docker compose 配置。

请仔细阅读 yaml 中的提示，修改 volumes 章节里面的数据里的文件夹到你希望的文件夹。同时，推荐修改镜像到南京大学的镜像站（即注释掉的那行）。

```yaml
version: '3.8'

services:
  tvsurf:
    image: ghcr.io/codewdy/tvsurf:latest
    # 如果上面的镜像太慢，也可以选择国内的镜像站：
    # image: ghcr.nju.edu.cn/codewdy/tvsurf:latest

    container_name: tvsurf

    # 在群晖 nas 中，由于权限问题，使用 root 用户操作目录，所以这里注释掉了
    # user: "${UID}:${GID}"

    # 存在项目路径下，如果想换路径，修改冒号前面的部分
    volumes:
      - .:/app/tvsurf/data

    # 修改第一个 9399 为你希望启动服务的端口
    ports:
      - "9399:9399"
    restart: unless-stopped
```

![新增项目细节](/doc/image/synology/new-docker-compose-details.png)

点击下一步，然后 *** 不要 *** 选择通过 Web Station 创建门户。点击下一步直到完成。

![等待1](/doc/image/synology/waiting-1.png)

![成功](/doc/image/synology/waiting-2.png)

此时访问对应的端口，应该会弹出如下界面：

![系统设置](/doc/image/system-setup.png)

推荐使用用户名密码模式，因为你的 nas 可能会对外网暴露端口，使用单用户模式将把所有信息不加密地暴露在外网上。