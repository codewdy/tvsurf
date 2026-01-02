from .subject import create_subject_searcher
from .channel import create_channel_searcher
from service.schema.tvdb import Source, SourceUrl
import asyncio
from service.lib.context import Context


class Searcher:
    def __init__(self, config: dict):
        self.key = config["key"]
        self.name = config["name"]
        self.subject_searcher = create_subject_searcher(config["subject_searcher"])
        self.channel_searcher = create_channel_searcher(config["channel_searcher"])

    async def search(self, keyword: str) -> list[Source]:
        results = []
        with Context.handle_error(f"search {self.name} {keyword}"):
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
        return results


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
                        [i.model_dump(mode="json") for i in rst],
                        ensure_ascii=False,
                        indent=2,
                    )
                )

    asyncio.run(run())
