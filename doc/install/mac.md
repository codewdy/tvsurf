# mac 安装 tvsurf

访问 [github release](https://github.com/codewdy/tvsurf/releases) 来获取最新版本。

双击打开 tvsurf.app，稍微等待一段时间，即可看到弹出的网页，同时在系统托盘处，也可以找到对应的图标。

第一次打开 app 可能会显示 "Apple 无法检查 App 是否包含恶意软件"，可以参照[Apple官方文档](https://support.apple.com/zh-cn/guide/mac-help/mchleab3a043/mac)处理。

![系统托盘](/doc/image/mac-tray.png)

![系统设置](/doc/image/system-setup.png)

通常来说，对于 mac 用户，使用单用户模式足够便捷，默认的不对外服务，也可以保护你的隐私不被网络上其他人获取。

你也可以把这个 tvsurf.app 拖到应用程序文件夹，这样你就可以通过 App 页面快速打开 tvsurf。

# 配置

注意，数据默认存储于 `/User/你的用户名/Library/Application Support/com.codewdy.tvsurf/data` 文件夹下，不推荐进行修改，因为 mac 的 sandbox 限制，你的修改可能会无法生效。

如果你一定要修改，就打开`/User/你的用户名/Library/Application Support/com.codewdy.tvsurf/config.yaml` 就行了。

```
# 数据目录，如果是相对路径，将根据配置文件的目录作为基准
data_dir: 'data'
# 服务端口
port: 9399
# local: 本地服务, 只服务本机，不对外开放端口; online: 在线服务，对外开放端口
server_type: local
```
