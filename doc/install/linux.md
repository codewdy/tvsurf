# Linux 安装

访问 [github release](https://github.com/codewdy/tvsurf/releases) 来获取最新版本。

对于 Ubuntu，你需要安装以下依赖（通常这些依赖已经存在了）：

```shell
apt-get install libxcb1 libdrm-dev libnss3 fontconfig fonts-dejavu-core
```

这些依赖主要是由于我们的爬虫需要执行chrome，这是chrome的一些依赖文件。

然后修改 tvsurf 里面的 config.yaml，修改为你喜欢的样子，或者也可以在其他地方新建一份 config.yaml。

最后执行

```shell
# 如果不传入 config，默认会使用 tvsurf 目录里自带的那份 config
tvsurf/tvsurf --config /path/to/config.yaml
```

此时访问对应的端口，应该会弹出如下界面：

![系统设置](/doc/image/system-setup.png)

推荐使用用户名密码模式，因为你的 Linux 服务器可能会对外网暴露端口，使用单用户模式将把所有信息不加密地暴露在外网上。