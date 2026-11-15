from pathlib import Path

import numpy as np
import pandas as pd

TICKERS = ("AAPL", "MSFT", "JPM", "XOM", "SPY", "TSLA", "NVDA", "AMZN", "META", "QQQ")
PRICE_FILE = Path(__file__).resolve().parents[1] / "data" / "prices.csv"


def load_prices(path: Path) -> pd.DataFrame:
    """Read and validate aligned daily adjusted closes."""
    prices = pd.read_csv(path, index_col="Date")
    if list(prices.columns.sort_values()) != sorted(TICKERS):
        raise ValueError(f"Expected CSV columns Date, {', '.join(TICKERS)}.")
    prices.index = pd.to_datetime(prices.index, errors="raise")
    if prices.index.has_duplicates or prices.index.hasnans:
        raise ValueError("Price dates must be valid and unique.")
    prices = prices.sort_index().reindex(columns=TICKERS).apply(pd.to_numeric)
    if not np.isfinite(prices.to_numpy()).all() or (prices <= 0).any().any():
        raise ValueError("Every adjusted close must be finite and positive.")
    if len(prices) < 60:
        raise ValueError("Provide at least 60 daily price rows.")
    return prices


def load_returns(path: Path) -> pd.DataFrame:
    """Take log price ratios on consecutive days."""
    return np.log(load_prices(path)).diff().iloc[1:]
