from .web import WebChannelSearcher
from service.lib.request import to_text
from urllib.parse import urljoin
from service.schema.searcher import Channel


class WebAChannelSearcher(WebChannelSearcher):
    def __init__(
        self,
        episode_lists,
        episodes_from_list,
        channel_names="",
        episode_links_from_list="",
        cover="",
        cover_attr="src",
    ):
        self.channel_names = channel_names
        self.episode_lists = episode_lists
        self.episodes_from_list = episodes_from_list
        self.episode_links_from_list = episode_links_from_list
        self.cover = cover
        self.cover_attr = cover_attr

    def parse_episode_list(self, src, list):
        episodes_tag = [i for i in list.select(self.episodes_from_list)]
        if self.episode_links_from_list:
            episode_links = [
                i["href"]
                for i in list.select(self.episode_links_from_list)
                if i.has_attr("href") and i["href"] != ""
            ]
        else:
            episode_links = []
        result = []
        for i in range(len(episodes_tag)):
            href = (
                episode_links[i] if i < len(episode_links) else episodes_tag[i]["href"]
            )
            if href == "" or href.startswith("javascript:"):
                continue
            result.append(
                Channel.Episode(
                    name=to_text(episodes_tag[i]),
                    url=urljoin(src, href),
                )
            )

        if len(result) == 0:
            raise FileNotFoundError(f"No Episode Result")
        return result

    def parse(self, src, soup):
        if self.channel_names:
            channel_names = [to_text(i) for i in soup.select(self.channel_names)]
        else:
            channel_names = ["default"]
        if self.cover:
            cover = urljoin(src, soup.select_one(self.cover)[self.cover_attr])
        else:
            cover = ""
        episode_lists = [
            self.parse_episode_list(src, i) for i in soup.select(self.episode_lists)
        ]
        return [
            Channel(name=name, episodes=l, cover_url=cover)
            for name, l in zip(channel_names, episode_lists)
        ]
