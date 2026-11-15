from math import pi, sqrt

import numpy as np
import pytest

from backend.risk import drawdown, historical_tail, normal_tail, sharpe_ratio


def test_historical_var_and_cvar() -> None:
    returns = np.array([-0.10, -0.06, -0.02, 0.04, 0.06, 0.08])
    tail = historical_tail(returns, 0.75)
    assert tail["var"] == pytest.approx(0.06)
    assert tail["cvar"] == pytest.approx((0.10 + 0.5 * 0.06) / 1.5)


def test_normal_var_and_cvar() -> None:
    returns = np.array([-0.02, 0.00, 0.02])
    tail = normal_tail(returns, 0.5)
    assert tail["var"] == pytest.approx(0)
    assert tail["cvar"] == pytest.approx(0.02 * sqrt(2 / pi))


def test_sharpe() -> None:
    returns = np.array([0.00, 0.01, 0.02])
    assert sharpe_ratio(returns) == pytest.approx(sqrt(252))
    assert sharpe_ratio(returns, 1.001**252 - 1) == pytest.approx(0.9 * sqrt(252))
    assert sharpe_ratio(np.zeros(3)) is None


def test_max_drawdown_includes_initial_peak() -> None:
    maximum, cumulative, underwater = drawdown(np.array([-0.25, 1.0, -0.20, 0.25]))
    assert maximum == pytest.approx(0.25)
    assert cumulative == pytest.approx([-0.25, 0.50, 0.20, 0.50])
    assert underwater == pytest.approx([-0.25, 0, -0.20, 0])
