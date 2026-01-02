import json
import asyncio
import sys
from service.lib.context import Context
from service.lib.path import searcher_config_path
from . import create_channel_searcher

src = sys.argv[-2]
url = sys.argv[-1]

with open(searcher_config_path(), "r") as f:
    searcher_config = json.load(f)
searcher_config = [i for i in searcher_config["searchers"] if i["key"] == src][0]
searcher = create_channel_searcher(searcher_config["channel_searcher"])


async def run():
    async with Context():
        rst = await searcher.search(url)
        print(rst)
        with open("result.json", "w") as f:
            f.write(
                json.dumps(
                    [i.model_dump(mode="json") for i in rst],
                    ensure_ascii=False,
                    indent=2,
                )
            )


asyncio.run(run())
