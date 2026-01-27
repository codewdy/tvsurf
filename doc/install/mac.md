# mac 安装 tvsurf

访问 [github release](https://github.com/codewdy/tvsurf/releases) 来获取最新版本。

双击打开 tvsurf.app，稍微等待一段时间，即可看到弹出的网页，同时在系统托盘处，也可以找到对应的图标。

第一次打开 app 会等一两分钟，原因暂时不太清楚。

![系统托盘](/doc/image/mac-tray.png)

![系统设置](/doc/image/system-setup.png)

通常来说，对于 mac 用户，使用单用户模式足够便捷，默认的不对外服务，也可以保护你的隐私不被网络上其他人获取。

注意：如果直接解压打开的话，数据会存储在 tvsurf.app 同目录下的 data 文件夹。
如果将 tvsurf.app 拷贝到 Application，则会在`/User/username/Library/Application Support/com.codewdy.tvsurf/data`下存储（同时在该目录下也会找到一份 config.yaml 可供配置）

# 配置

注意，数据默认存储于和 tvsurf 同目录下的 data 文件夹，如果你需要自己配置，可以修改 config.yaml。

```
# 数据目录，如果是相对路径，将根据配置文件的目录作为基准
data_dir: 'data'
# 服务端口
port: 9399
# local: 本地服务, 只服务本机，不对外开放端口; online: 在线服务，对外开放端口
server_type: local
```
