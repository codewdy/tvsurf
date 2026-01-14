import asyncio
import platform
import subprocess


async def run_cmd(*cmd):
    creationflags = 0
    if platform.system() == "Windows":
        creationflags = subprocess.CREATE_NO_WINDOW  # type: ignore
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        creationflags=creationflags,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise ValueError(f"cmd {cmd} failed")
    return stdout.decode(), stderr.decode()
