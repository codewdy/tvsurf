import asyncio
from aiohttp import web
from service.tracker.tracker import Tracker
from service.server.api import create_routes
from aiohttp.web_runner import _raise_graceful_exit
from service.lib.path import web_path
from service.server.web import web_routes
from service.server.resource import resource_routes
import base64
from typing import Optional
import socket
import threading
from service.lib.config_loader import load_config


class App:
    def __init__(self, config_path: str):
        self.config = load_config(config_path)
        self.tracker = Tracker(self.config)

    def redirect_func(self, token: Optional[str], path: str) -> Optional[str]:
        if path == "/favicon.ico" or path.startswith("/assets/"):
            return None
        if self.tracker.need_system_setup():
            return "/system-setup?redirect=" + base64.b64encode(path.encode()).decode()
        if not self.tracker.token_validate(token):
            return "/login?redirect=" + base64.b64encode(path.encode()).decode()
        return None

    async def on_startup(self) -> None:
        await self.tracker.start()

    async def on_shutdown(self) -> None:
        self.tracker.save()
        self.sock.close()

    async def on_cleanup(self) -> None:
        await self.tracker.stop()

    def create_app(self):
        self.app = web.Application()
        self.app.add_routes(create_routes(self.tracker))
        self.app.add_routes(
            web_routes(
                "/",
                web_path(),
                "index.html",
                ["system-setup", "login"],
                self.redirect_func,
            )
        )
        self.app.add_routes(
            resource_routes(
                "/resource",
                self.config.data_dir + "/tv",
                self.tracker.token_validate,
            )
        )

        self.app.on_startup.append(lambda app: self.on_startup())
        self.app.on_cleanup.append(lambda app: self.on_cleanup())
        self.app.on_shutdown.append(lambda app: self.on_shutdown())

    def mk_socket_local(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(("localhost", self.port()))

    def mk_socket_online(self):
        self.sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(("::", self.port()))

    def mk_socket(self):
        if self.config.server_type == "local":
            self.mk_socket_local()
        elif self.config.server_type == "online":
            self.mk_socket_online()
        else:
            raise ValueError(f"Invalid server type: {self.config.server_type}")

    def prepare(self):
        self.loop = asyncio.new_event_loop()
        self.create_app()
        self.mk_socket()

    def port(self):
        return self.config.port

    def run(self):
        web.run_app(self.app, sock=self.sock, loop=self.loop, shutdown_timeout=1)

    def serve(self):
        self.prepare()
        self.run()

    def wait_start(self):
        self.tracker.wait_start()

    def thread_serve(self):
        self.prepare()
        self.thread = threading.Thread(target=self.run)
        self.thread.start()
        self.stoped = False

    def stop_thread(self):
        if self.stoped:
            return
        self.stoped = True
        self.loop.call_soon_threadsafe(_raise_graceful_exit)
        self.thread.join()
