from math import expm1, log1p, sqrt
from statistics import NormalDist

import numpy as np
from numpy.typing import NDArray

Array = NDArray[np.float64]
TRADING_DAYS = 252


def historical_tail(returns: Array, confidence: float) -> dict[str, float]:
    """Take the empirical loss quantile and average the worst tail probability."""
    losses = np.sort(-returns)[::-1]
    tail_size = len(losses) * (1 - confidence)
    whole = int(tail_size)
    mass = losses[:whole].sum() + (tail_size - whole) * losses[whole]
    return {
        "var": float(np.quantile(losses, confidence, method="inverted_cdf")),
        "cvar": float(mass / tail_size),
    }


def normal_tail(returns: Array, confidence: float) -> dict[str, float]:
    """Use the normal loss quantile and the conditional mean above it."""
    normal = NormalDist()
    z = normal.inv_cdf(confidence)
    mean_loss = float(-returns.mean())
    volatility = float(returns.std(ddof=1))
    return {
        "var": mean_loss + z * volatility,
        "cvar": mean_loss + volatility * normal.pdf(z) / (1 - confidence),
    }


def sharpe_ratio(returns: Array, risk_free_rate: float = 0.0) -> float | None:
    """Divide mean excess daily return by sample volatility and annualize."""
    volatility = float(returns.std(ddof=1))
    if volatility == 0:
        return None
    daily_rate = expm1(log1p(risk_free_rate) / TRADING_DAYS)
    return float((returns.mean() - daily_rate) / volatility * sqrt(TRADING_DAYS))


def drawdown(returns: Array) -> tuple[float, Array, Array]:
    """Compound daily returns and measure their decline from the running peak."""
    wealth = np.cumprod(1 + returns)
    peaks = np.maximum.accumulate(np.concatenate(([1.0], wealth)))[1:]
    underwater = wealth / peaks - 1
    return float(-underwater.min()), wealth - 1, underwater
