import asyncio
import base64
import json
from urllib.parse import parse_qs, unquote, urlparse

from service.lib.context import Context
from service.lib.header import HEADERS

from .base import BaseResourceSearcher


def _b64decode(s: str) -> bytes:
    pad = (4 - len(s) % 4) % 4
    return base64.b64decode(s + "=" * pad)


def _parse_player_object(html: str, var_name: str) -> dict:
    prefix = f"var {var_name}="
    i = html.find(prefix)
    if i < 0:
        raise ValueError(f"cannot find {var_name}")
    i += len(prefix)
    while i < len(html) and html[i] in " \t\n\r":
        i += 1
    if html[i] != "{":
        raise ValueError("expected { after var")
    start = i
    depth = 0
    in_string = False
    escape = False
    j = i
    while j < len(html):
        c = html[j]
        if in_string:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == '"':
                in_string = False
            j += 1
            continue
        if c == '"':
            in_string = True
            j += 1
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return json.loads(html[start : j + 1])
        j += 1
    raise ValueError("unclosed player json object")


def _decode_maccms_url(encrypt: int, url: str) -> str:
    if encrypt == 0:
        return url
    if encrypt == 1:
        return _b64decode(url).decode("utf-8")
    if encrypt == 2:
        raw = _b64decode(url).decode("ascii")
        return unquote(raw)
    raise ValueError(f"unsupported maccms encrypt mode: {encrypt}")


def _unwrap_embedded_url(video_url: str) -> str:
    parsed_url = urlparse(video_url)
    query_params = parse_qs(parsed_url.query)
    if "url" in query_params:
        inner = query_params["url"][0]
        if isinstance(inner, bytes):
            inner = inner.decode("utf-8")
        return inner
    return video_url


class MaccmsPlayerResourceSearcher(BaseResourceSearcher):
    """Resolve play URL from MacCMS `var player_aaaa=...` in page HTML (no browser)."""

    def __init__(self, var_name: str = "player_aaaa"):
        self.var_name = var_name

    async def search(self, url: str, _retry: int = 3) -> str:
        async with Context.client.get(url, headers=HEADERS) as response:
            if response.status == 429:
                if _retry > 0:
                    await asyncio.sleep(5)
                    return await self.search(url, _retry - 1)
                raise RuntimeError(f"rate limited: {url}")
            if response.status != 200:
                raise RuntimeError(
                    f"cannot get play page status_code={response.status} url={url}"
                )
            html = await response.text()
        data = _parse_player_object(html, self.var_name)
        encrypt = int(data.get("encrypt", 0))
        enc_url = data.get("url")
        if not enc_url:
            raise ValueError(f"no url in {self.var_name}: {url}")
        video_url = _decode_maccms_url(encrypt, enc_url)
        return _unwrap_embedded_url(video_url)
