import json
import os
import time
from datetime import date, timedelta
from functools import lru_cache
from typing import Any
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


@lru_cache(maxsize=64)
def fetch_news(ticker: str | None, cache_window: int) -> list[dict[str, Any]]:
    """Fetch and cache public headlines using the server-side Finnhub token."""
    today = date.today()
    params = {"symbol": ticker, "from": str(today - timedelta(days=7)), "to": str(today)} if ticker else {"category": "general"}
    endpoint = "company-news" if ticker else "news"
    request = Request(
        f"https://finnhub.io/api/v1/{endpoint}?{urlencode(params)}",
        headers={"X-Finnhub-Token": os.environ["FINNHUB_API_KEY"]},
    )
    with urlopen(request, timeout=8) as response:
        payload = json.load(response)
    if not isinstance(payload, list):
        raise ValueError("Unexpected Finnhub response.")
    articles = []
    for row in payload:
        if not isinstance(row, dict):
            continue
        url = row.get("url")
        if not isinstance(url, str) or urlparse(url).scheme not in ("https", "http"):
            continue
        if not row.get("headline") or not isinstance(row.get("datetime"), int):
            continue
        articles.append({
            "headline": row["headline"], "source": row.get("source") or "Publisher",
            "timestamp": row["datetime"], "url": url,
        })
    return sorted(articles, key=lambda item: item["timestamp"], reverse=True)[:12]


def market_news(ticker: str | None) -> dict[str, Any]:
    """Return an explicit setup state when the optional feed is disabled."""
    configured = bool(os.environ.get("FINNHUB_API_KEY", "").strip())
    return {
        "configured": configured,
        "articles": fetch_news(ticker, int(time.time()) // 300) if configured else [],
    }
