from bs4 import BeautifulSoup
from bs4.element import NavigableString
from .context import Context
import asyncio
import json
from .header import HEADERS


async def request(url, retry=3):
    async with Context.client.get(url, headers=HEADERS) as response:
        if response.status == 429:
            if retry > 0:
                await asyncio.sleep(5)
                return await request(url, retry - 1)
        if response.status != 200:
            raise RuntimeError(f"cannot get result status_code={response.status}")
        return BeautifulSoup(await response.text(), features="lxml")


async def request_json(url, retry=3):
    async with Context.client.get(url, headers=HEADERS) as response:
        if response.status == 429:
            if retry > 0:
                await asyncio.sleep(5)
                return await request(url, retry - 1)
        if response.status != 200:
            raise RuntimeError(f"cannot get result status_code={response.status}")
        return json.loads(await response.text())


def to_text(token) -> str:
    if "title" in token.attrs:
        return token.attrs["title"]
    for child in token.children:
        if isinstance(child, NavigableString):
            return child.text.strip()
    return token.text.strip()
