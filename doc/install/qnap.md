# 为威联通 nas 安装 tvsurf

### 新建文件夹

在你喜欢的位置新建一个文件夹，以供数据存储。我这里在/Public目录下新建了一个叫tvsurf的文件夹。

![新建文件夹](/doc/image/qnap/location.png)

### 获得你用户的 uid

正常情况下，如果你在建立系统时建立的用户的 uid 是 1000，以防万一，你可以通过以下方法 check 以下。

打开控制台，点击用户，然后在用户界面点击编辑账户资料，就可以看到uid。

![uid-1](/doc/image/qnap/uid-1.png)

![uid-2](/doc/image/qnap/uid-2.png)

### 新建 docker 应用程序

打开"container station 容器工作站"（如果没有可以去App Center下载），选择应用程序，点击创建，并输入下面的配置。

注意：以下的配置有一些需要根据你的实际情况进行改动的，请仔细阅读里面的注释。同时，推荐修改镜像到南京大学的镜像站（即注释掉的那行）。


```yaml
version: '3.8'

services:
  tvsurf:
    image: ghcr.io/codewdy/tvsurf:latest
    # 如果上面的镜像太慢，也可以选择国内的镜像站：
    # image: ghcr.nju.edu.cn/codewdy/tvsurf:latest

    container_name: tvsurf

    # 这里的 1000 就是你之前获取的 uid，100是对应的用户组 anyone，通常不需要修改
    user: 1000:100

    # 我这里用的是 /Public/tvsurf 作为内部存储
    # 注意在这里需要加上 /share 前缀
    volumes:
      - /share/Public/tvsurf:/app/tvsurf/data

    # 修改第一个 9399 为你希望启动服务的端口
    ports:
      - "9399:9399"
    restart: unless-stopped
```

![container-station](/doc/image/qnap/container-station.png)

![docker-compose](/doc/image/qnap/create-docker-compose.png)


### 安装成功

当出现以下界面的时候说明安装成功：

![安装成功](/doc/image/qnap/install-ok.png)

然后你可以访问你服务器的对应端口（在默认配置里是9399）来访问服务。

![系统设置](/doc/image/system-setup.png)

推荐使用用户名密码模式，因为你的 nas 可能会对外网暴露端口，使用单用户模式将把所有信息不加密地暴露在外网上。