from functools import cache
import asyncio
from service.lib.context import Context
from service.lib.path import searcher_config_path
from .searcher import Searcher
from pathlib import Path
import json
from service.schema.tvdb import Source
from service.schema.tvdb import SourceUrl
from typing import Optional


@cache
def searcher_list():
    with open(searcher_config_path(), "r", encoding="utf-8") as f:
        searcher_config = json.load(f)
    return [
        Searcher(config) for config in searcher_config["searchers"] if config["enable"]
    ]


class Searchers:
    def __init__(self):
        self.searchers = searcher_list()
        self.searcher_dict = {searcher.key: searcher for searcher in self.searchers}

    async def search(self, keyword: str) -> list[Source]:
        results = await asyncio.gather(
            *[searcher.search(keyword) for searcher in self.searchers]
        )
        return sum(results, [])

    async def update_source(self, source: Source) -> Optional[Source]:
        with Context.handle_error(
            title=f"update_source {source.name} - {source.source.source_key}"
        ):
            return await self.searcher_dict[source.source.source_key].update_source(
                source
            )

    async def get_resource(self, source: SourceUrl) -> str:
        return await self.searcher_dict[source.source_key].get_resource(source.url)


if __name__ == "__main__":
    import json
    import asyncio
    import sys
    from service.lib.context import Context
    from service.lib.path import searcher_config_path

    keyword = sys.argv[-1]

    async def run():
        async with Context():
            searchers = Searchers()
            rst = await searchers.search(keyword)
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
