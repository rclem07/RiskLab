from functools import lru_cache
from pathlib import Path
from statistics import NormalDist
from typing import Annotated, Any, Literal
from urllib.error import URLError

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator, model_validator

from .data import PRICE_FILE, TICKERS, load_prices, load_returns
from .forecast import volatility_forecast
from .news import market_news
from .report import risk_report
from .risk import drawdown, historical_tail, normal_tail, sharpe_ratio

app = FastAPI(title="RiskLab")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

Ticker = Literal["AAPL", "MSFT", "JPM", "XOM", "SPY", "TSLA", "NVDA", "AMZN", "META", "QQQ"]
Scenario = Literal["2008 crash", "COVID crash", "Rate shock", "custom"]
Confidence = Annotated[float, Field(gt=0.5, lt=1)]
Weight = Annotated[float, Field(ge=0, allow_inf_nan=False)]
Shock = Annotated[float, Field(ge=-100, allow_inf_nan=False)]


class Portfolio(BaseModel):
    weights: dict[Ticker, Weight] = Field(default_factory=lambda: dict.fromkeys(TICKERS, 1 / len(TICKERS)))

    @field_validator("weights")
    @classmethod
    def positive_weights(cls, weights: dict[str, float]) -> dict[str, float]:
        """Require a positive allocation and normalize safely."""
        maximum = max(weights.values(), default=0)
        if maximum <= 0:
            raise ValueError("At least one asset must have a positive weight.")
        scaled = {ticker: weights.get(ticker, 0) / maximum for ticker in TICKERS}
        total = sum(scaled.values())
        return {ticker: value / total for ticker, value in scaled.items()}


class RiskRequest(Portfolio):
    confidence: Confidence = 0.95
    risk_free_rate: float = Field(default=0, gt=-1, allow_inf_nan=False)


class StressRequest(Portfolio):
    scenario: Scenario
    shocks: dict[Ticker, Shock] | None = None

    @model_validator(mode="after")
    def require_custom_shocks(self) -> "StressRequest":
        """Require a percentage shock for every ticker in a custom scenario."""
        if self.scenario == "custom" and set(self.shocks or {}) != set(TICKERS):
            raise ValueError("Custom scenarios require a percentage shock for every ticker.")
        return self


@lru_cache(maxsize=4)
def cached_returns(path: Path, modified: int) -> pd.DataFrame:
    return load_returns(path)


def data_key() -> tuple[Path, int]:
    try:
        return PRICE_FILE, PRICE_FILE.stat().st_mtime_ns
    except OSError as exc:
        raise HTTPException(503, "Missing data/prices.csv. Run python scripts/fetch_data.py.") from exc


def returns_for(key: tuple[Path, int]) -> pd.DataFrame:
    try:
        return cached_returns(*key)
    except (OSError, ValueError, KeyError) as exc:
        raise HTTPException(503, f"Could not load price data. {exc}") from exc


@lru_cache(maxsize=20)
def forecast_for(key: tuple[Path, int], ticker: str) -> dict[str, Any]:
    returns = returns_for(key)
    try:
        return volatility_forecast(returns[ticker])
    except (ValueError, np.linalg.LinAlgError) as exc:
        raise HTTPException(422, f"Could not fit volatility models. {exc}") from exc


@app.get("/api/forecast")
def forecast(ticker: Ticker = "SPY") -> dict[str, Any]:
    """Return aligned test dates, realized volatility, forecasts, and scores."""
    return forecast_for(data_key(), ticker)


@app.get("/api/prices")
def prices() -> dict[str, Any]:
    """Return the latest year of adjusted closes for holdings valuation."""
    path, _ = data_key()
    try:
        closes = load_prices(path).tail(253)
    except (OSError, ValueError, KeyError) as exc:
        raise HTTPException(503, f"Could not load price data. {exc}") from exc
    return {
        "dates": closes.index.strftime("%Y-%m-%d").tolist(),
        "closes": closes.to_dict(orient="list"),
    }


@app.get("/api/news")
def news(ticker: Ticker | None = None) -> dict[str, Any]:
    """Return market headlines or headlines for one supported ticker."""
    try:
        return market_news(ticker)
    except (URLError, OSError, ValueError) as exc:
        raise HTTPException(502, "Finnhub news is unavailable. Check the API key and network.") from exc


class ReportRequest(RiskRequest, StressRequest):
    ticker: Ticker = "SPY"


@app.post("/api/report")
def report(request: ReportRequest) -> Response:
    """Download a snapshot of the requested forecast, portfolio risk, and stress test."""
    pdf = risk_report(request.ticker, request.scenario, request.confidence,
                      forecast(request.ticker), risk(request), stress(request))
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="risklab-report.pdf"'})


@app.post("/api/risk")
def risk(request: RiskRequest) -> dict[str, Any]:
    """Compute one-day portfolio tail risk and historical performance metrics."""
    logs = returns_for(data_key())
    portfolio = np.expm1(logs.to_numpy()) @ np.array([request.weights[t] for t in TICKERS])
    max_drawdown, cumulative, underwater = drawdown(portfolio)
    return {
        "historical": historical_tail(portfolio, request.confidence),
        "parametric": normal_tail(portfolio, request.confidence),
        "sharpe": sharpe_ratio(portfolio, request.risk_free_rate),
        "max_drawdown": max_drawdown,
        "dates": logs.index.strftime("%Y-%m-%d").tolist(),
        "cumulative_return": cumulative.tolist(),
        "drawdown": underwater.tolist(),
    }


@app.post("/api/stress")
def stress(request: StressRequest) -> dict[str, Any]:
    """Sum the weighted percentage shocks and express declines as positive losses."""
    presets = {"2008 crash": -35, "COVID crash": -30, "Rate shock": -10}
    if request.scenario == "custom":
        shocks = request.shocks or {}
    else:
        shocks = dict.fromkeys(TICKERS, presets[request.scenario])
        if request.scenario == "Rate shock":
            shocks["JPM"] = -15
    contributions = {ticker: -request.weights[ticker] * (shocks[ticker] / 100) for ticker in TICKERS}
    return {"loss": sum(contributions.values()), "contributions": contributions}


@app.get("/api/var-backtest")
def var_backtest(
    ticker: Ticker = "SPY", confidence: Annotated[float, Query(gt=0.5, lt=1)] = 0.95
) -> dict[str, Any]:
    """Count log losses above each zero-mean normal VaR forecast."""
    key = data_key()
    forecast = forecast_for(key, ticker)
    observations = len(forecast["dates"])
    losses = -returns_for(key)[ticker].iloc[-observations:].to_numpy()
    z = NormalDist().inv_cdf(confidence)
    expected = observations * (1 - confidence)
    models = {}
    for model, forecasts in forecast["predictions"].items():
        thresholds = z * np.asarray(forecasts)
        exceedances = int(np.count_nonzero(losses > thresholds))
        models[model] = {
            "var": thresholds.tolist(),
            "exceedances": exceedances,
            "expected_exceedances": expected,
            "exceedance_rate": exceedances / observations,
        }
    return {"dates": forecast["dates"], "observations": observations, "models": models}
