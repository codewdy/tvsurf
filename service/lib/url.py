import re


def change_url_domain(url: str, domain: str) -> str:
    return re.sub(r"^https?://[^/]+", domain, url)
