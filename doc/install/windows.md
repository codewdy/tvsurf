# Windows 安装 tvsurf

访问 [github release](https://github.com/codewdy/tvsurf/releases) 来获取最新版本。

双击打开 tvsurf.exe，稍微等待一段时间，即可看到弹出的网页，同时在系统托盘处，也可以找到对应的图标。

注意：由于Windows Defender会进行扫描，所以第一次启动程序的时候会比较慢，可能需要几分钟，第二次之后就会好转。

![系统托盘](/doc/image/tray.png)

![系统设置](/doc/image/system-setup.png)

通常来说，对于 windows 用户，使用单用户模式足够便捷，默认的不对外服务，也可以保护你的隐私不被网络上其他人获取。

# 配置

注意，数据默认存储于和tvsurf.exe同目录下的data文件夹，如果你需要自己配置，可以修改config.ya412931ml。

```
# 数据目录，如果是相对路径，将根据配置文件的目录作为基准
data_dir: 'data'
# 服务端口
port: 9399
# local: 本地服务, 只服务本机，不对外开放端口; online: 在线服务，对外开放端口
server_type: local
```
