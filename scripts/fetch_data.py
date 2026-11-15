from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import yfinance as yf

TICKERS = ["AAPL", "MSFT", "JPM", "XOM", "SPY", "TSLA", "NVDA", "AMZN", "META", "QQQ"]
START = "2015-01-01"
PRICE_FILE = Path(__file__).resolve().parents[1] / "data" / "prices.csv"


def main() -> None:
    """Download adjusted daily closes and write an aligned local CSV."""
    today = datetime.now(ZoneInfo("America/New_York")).date()
    raw = yf.download(
        TICKERS, start=START, end=(today + timedelta(days=1)).isoformat(),
        interval="1d", auto_adjust=True, progress=False, threads=False, timeout=10,
    )
    if raw is None or raw.empty or "Close" not in raw:
        raise SystemExit("Yahoo Finance returned no adjusted closes.")
    closes = raw["Close"].reindex(columns=TICKERS).sort_index()
    missing = closes.columns[closes.isna().all()].tolist()
    if missing:
        raise SystemExit(f"Yahoo Finance returned no closes for: {', '.join(missing)}")
    closes = closes.ffill().dropna()
    if len(closes) < 60 or not np.isfinite(closes.to_numpy()).all() or (closes <= 0).any().any():
        raise SystemExit("Yahoo Finance returned insufficient or invalid adjusted closes.")
    closes.index.name = "Date"
    PRICE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = PRICE_FILE.with_suffix(".tmp")
    closes.to_csv(temporary, date_format="%Y-%m-%d")
    temporary.replace(PRICE_FILE)
    print(f"{PRICE_FILE}: {closes.shape}, {closes.index[0].date()} to {closes.index[-1].date()}")


if __name__ == "__main__":
    main()
