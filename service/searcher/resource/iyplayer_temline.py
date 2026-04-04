import asyncio
import base64
import json
import re
from urllib.parse import parse_qs, unquote, urlparse

from service.lib.context import Context
from service.lib.header import HEADERS
from service.lib.request import request_text

from .base import BaseResourceSearcher
from .maccms_player import _unwrap_embedded_url

_TEMLINE_PREFIX = "var temLineList = "
_LINE_ID_RE = re.compile(r"var lineId = Number\(['\"](\d+)['\"]\)")


def _b64pad(s: str) -> str:
    pad = (4 - len(s) % 4) % 4
    return s + "=" * pad


def _decode_iy_file(file_wrapped: str) -> str:
    raw_b64 = file_wrapped[3:]
    inner = base64.b64decode(_b64pad(raw_b64)).decode("ascii")
    return unquote(inner)


def _parse_tem_line_list(html: str) -> list:
    p = html.find(_TEMLINE_PREFIX)
    if p < 0:
        raise ValueError("cannot find var temLineList")
    i = p + len(_TEMLINE_PREFIX)
    while i < len(html) and html[i] in " \t\n\r":
        i += 1
    if html[i] != "[":
        raise ValueError("expected [ after temLineList")
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
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                return json.loads(html[start : j + 1])
        j += 1
    raise ValueError("unclosed temLineList array")


class IyplayerTemlineResourceSearcher(BaseResourceSearcher):
    """Decode iyplayer `temLineList[].file` (base64 + strip 3 chars) from player HTML."""

    async def search(self, url: str, _retry: int = 3) -> str:
        html = await request_text(url, _retry)

        qs = parse_qs(urlparse(url).query)
        line_id_s = (qs.get("line_id") or [None])[0]
        line_id = int(line_id_s) if line_id_s else None

        items = _parse_tem_line_list(html)
        if not items:
            raise ValueError(f"empty temLineList: {url}")

        if line_id is None:
            m = _LINE_ID_RE.search(html)
            line_id = int(m.group(1)) if m else int(items[0]["id"])

        row = next((x for x in items if int(x.get("id", -1)) == line_id), None)
        if row is None:
            raise ValueError(f"line_id {line_id} not in temLineList: {url}")

        file_wrapped = row.get("file")
        if not file_wrapped or len(file_wrapped) < 4:
            raise ValueError(f"bad file field for line_id {line_id}: {url}")

        video_url = _decode_iy_file(file_wrapped)
        return _unwrap_embedded_url(video_url)
