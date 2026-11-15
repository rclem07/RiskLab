from math import sqrt
from typing import Any

import numpy as np
import pandas as pd

from .risk import Array


def mlp_volatility(training: Array, target: Array, test: Array) -> Array:
    """Fit a small tanh network by full-batch gradient descent on training data."""
    mean = training.mean(axis=0)
    scale = training.std(axis=0)
    scale[scale == 0] = 1
    x = (training - mean) / scale
    y = target * 100
    hidden_weights = np.random.default_rng(42).normal(0, 0.2, (x.shape[1], 8))
    hidden_bias = np.zeros(8)
    output_weights = np.zeros(8)
    output_bias = float(y.mean())
    for _ in range(350):
        hidden = np.tanh(x @ hidden_weights + hidden_bias)
        residual = (hidden @ output_weights + output_bias - y) / len(y)
        gradient = residual[:, None] * output_weights * (1 - hidden**2)
        output_weights -= 0.02 * (hidden.T @ residual + 0.001 * output_weights)
        output_bias -= 0.02 * residual.sum()
        hidden_weights -= 0.02 * (x.T @ gradient + 0.001 * hidden_weights)
        hidden_bias -= 0.02 * gradient.sum(axis=0)
    prediction = np.tanh(((test - mean) / scale) @ hidden_weights + hidden_bias) @ output_weights
    return np.maximum((prediction + output_bias) / 100, 0)


def garch_volatility(returns: Array, split: int) -> Array:
    """Fit on training returns and update next-day variance with past returns."""
    from arch import arch_model

    training = returns[:split] * 100
    if not np.any(training):
        return np.zeros(len(returns) - split)
    fitted = arch_model(training, mean="Zero", p=1, q=1, rescale=False).fit(disp="off")
    if fitted.convergence_flag:
        raise ValueError("GARCH did not converge for the selected ticker.")
    omega, alpha, beta = fitted.params[["omega", "alpha[1]", "beta[1]"]]
    variance = float(fitted.forecast(horizon=1).variance.iloc[-1, 0])
    predictions = []
    for observed in returns[split:]:
        predictions.append(sqrt(variance) / 100)
        variance = omega + alpha * (observed * 100) ** 2 + beta * variance
    return np.asarray(predictions)


def volatility_forecast(returns: pd.Series) -> dict[str, Any]:
    """Compare one-day forecasts against absolute daily log returns."""
    realized = returns.abs()
    prior = realized.shift(1)
    features = np.column_stack((
        np.ones(len(returns)), prior, prior.rolling(5).mean(), prior.rolling(22).mean()
    ))
    split = int(len(returns) * 0.8)
    coefficients = np.linalg.lstsq(features[22:split], realized.iloc[22:split], rcond=None)[0]
    actual = realized.iloc[split:].to_numpy()
    predictions = {
        "naive": prior.iloc[split:].to_numpy(),
        "har": np.maximum(features[split:] @ coefficients, 0),
        "garch": garch_volatility(returns.to_numpy(), split),
        "mlp": mlp_volatility(features[22:split, 1:], realized.iloc[22:split].to_numpy(), features[split:, 1:]),
    }
    metrics = {}
    for model, prediction in predictions.items():
        errors = prediction - actual
        mse = float(np.mean(errors ** 2))
        metrics[model] = {"mae": float(np.mean(np.abs(errors))), "mse": mse, "rmse": sqrt(mse)}
    return {
        "dates": returns.index[split:].strftime("%Y-%m-%d").tolist(),
        "actual": actual.tolist(),
        "predictions": {model: values.tolist() for model, values in predictions.items()},
        "metrics": metrics,
    }
