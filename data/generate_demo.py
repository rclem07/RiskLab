import csv
import random
from datetime import date, timedelta
from math import exp
from pathlib import Path

TICKERS = ["AAPL", "MSFT", "JPM", "XOM", "SPY", "TSLA", "NVDA", "AMZN", "META", "QQQ"]
BETAS = [1.25, 1.15, 1.1, 0.85, 1.0, 1.8, 1.6, 1.3, 1.35, 1.2]


def main() -> None:
    """Write reproducible synthetic prices to a separate demo file."""
    rng = random.Random(97)
    path = Path(__file__).with_name("demo_prices.csv")
    day = date(2019, 1, 2)
    prices = [100.0] * len(TICKERS)
    variance = 0.0001
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(["Date", *TICKERS])
        for _ in range(1500):
            while day.weekday() >= 5:
                day += timedelta(days=1)
            market = rng.gauss(0, variance**0.5)
            variance = 0.000005 + 0.12 * market**2 + 0.83 * variance
            for i, beta in enumerate(BETAS):
                residual = rng.gauss(0, 0.006) if TICKERS[i] != "SPY" else 0
                prices[i] *= exp(0.0003 + beta * market + residual)
            writer.writerow([day.isoformat(), *[round(price, 6) for price in prices]])
            day += timedelta(days=1)
    print(path)


if __name__ == "__main__":
    main()
