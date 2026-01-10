from .subject import create_subject_searcher
from .channel import create_channel_searcher
from .resource import create_resource_searcher
from service.schema.tvdb import Source, SourceUrl
import asyncio
from service.lib.context import Context
from typing import Optional
from service.schema.searcher import SearchError


class Searcher:
    def __init__(self, config: dict):
        self.key = config["key"]
        self.name = config["name"]
        self.subject_searcher = create_subject_searcher(config["subject_searcher"])
        self.channel_searcher = create_channel_searcher(config["channel_searcher"])
        self.resource_searcher = create_resource_searcher(config["resource_searcher"])

    async def search(self, keyword: str) -> tuple[list[Source], list[SearchError]]:
        try:
            with Context.handle_error(f"search {self.name} {keyword}", rethrow=True):
                results: list[Source] = []
                subjects = await self.subject_searcher.search(keyword)
                all_channels = await asyncio.gather(
                    *[self.channel_searcher.search(subject.url) for subject in subjects]
                )
                for subject, channels in zip(subjects, all_channels):
                    for channel in channels:
                        results.append(
                            Source(
                                source=SourceUrl(
                                    source_key=self.key,
                                    source_name=self.name,
                                    channel_name=channel.name,
                                    url=subject.url,
                                ),
                                name=subject.name,
                                cover_url=subject.cover_url or channel.cover_url,
                                episodes=[
                                    Source.Episode(
                                        source=SourceUrl(
                                            source_key=self.key,
                                            source_name=self.name,
                                            channel_name=channel.name,
                                            url=e.url,
                                        ),
                                        name=e.name,
                                    )
                                    for e in channel.episodes
                                ],
                            )
                        )
                return results, []
        except Exception as e:
            return [], [
                SearchError(source_key=self.key, source_name=self.name, error=str(e))
            ]

    async def update_source(self, source: Source) -> Optional[Source]:
        channels = await self.channel_searcher.search(source.source.url)
        channel = next(
            (c for c in channels if c.name == source.source.channel_name), None
        )
        if channel is None:
            raise KeyError(f"channel {source.source.channel_name} not found")
        if len(source.episodes) == len(channel.episodes):
            return None
        return Source(
            source=source.source,
            name=source.name,
            cover_url=source.cover_url,
            episodes=source.episodes
            + [
                Source.Episode(
                    source=SourceUrl(
                        source_key=self.key,
                        source_name=self.name,
                        channel_name=channel.name,
                        url=e.url,
                    ),
                    name=e.name,
                )
                for e in channel.episodes[len(source.episodes) :]
            ],
        )

    async def get_resource(self, url: str) -> str:
        return await self.resource_searcher.search(url)


if __name__ == "__main__":
    import json
    import asyncio
    import sys
    from service.lib.context import Context
    from service.lib.path import searcher_config_path

    src = sys.argv[-2]
    keyword = sys.argv[-1]
    with open(searcher_config_path(), "r") as f:
        searcher_config = json.load(f)
    searcher_config = [i for i in searcher_config["searchers"] if i["key"] == src][0]
    searcher = Searcher(searcher_config)

    async def run():
        async with Context():
            rst = await searcher.search(keyword)
            print(rst)
            with open("result.json", "w") as f:
                f.write(
                    json.dumps(
                        [
                            [x.model_dump(mode="json"), y.model_dump(mode="json")]
                            for x, y in rst
                        ],
                        ensure_ascii=False,
                        indent=2,
                    )
                )

    asyncio.run(run())
