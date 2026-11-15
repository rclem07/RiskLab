import React, { useEffect, useId, useRef, useState } from 'react';

export const terms = {
  'Volatility': 'The size of price swings, regardless of direction. RiskLab uses the absolute daily log return as a daily volatility proxy.',
  'Naive': 'Uses yesterday’s absolute daily log return as today’s volatility estimate. It serves as the baseline.',
  'HAR': 'Heterogeneous autoregression. A linear regression on the previous 1-, 5-, and 22-day averages of realized volatility.',
  'GARCH(1,1)': 'Updates estimated variance using the previous squared return and the previous variance. Its square root is the volatility forecast.',
  'MLP': 'A small neural network learns a nonlinear relationship between the past 1-, 5-, and 22-day volatility averages and next-day volatility.',
  'MAE': 'Mean absolute error. The average size of the forecast miss, in the same units as the forecast. Lower is better.',
  'MSE': 'Mean squared error. Squares each miss before averaging, so larger misses count more. The units are squared.',
  'RMSE': 'Root mean squared error. Takes the square root of MSE to put the score back in volatility units. Lower is better.',
  'VaR': 'Value at Risk estimates a one-day loss threshold at the chosen confidence. At 95%, losses can exceed it on about 5% of days if the model is well calibrated.',
  'CVaR': 'Conditional Value at Risk estimates the average loss in the worst tail. At 95% confidence, that is the worst 5% of days under the chosen method.',
  'Historical': 'Uses the empirical distribution of past portfolio returns. VaR uses a loss quantile and CVaR averages the worst tail.',
  'Normal': 'Uses a normal distribution fitted to the mean and standard deviation of daily portfolio returns. Heavy tails can make this assumption underestimate large losses.',
  'Sharpe ratio': 'Annualized average daily return above the risk-free rate divided by daily return volatility. Higher means more historical excess return per unit of volatility.',
  'Max drawdown': 'The largest percentage decline from a previous portfolio peak to a later low, including the starting balance as a peak.',
  'Confidence': 'Sets the size of the loss tail. A confidence of 95% considers the worst 5% of the distribution.',
  'Risk-free rate': 'An annual benchmark return used to measure excess return in the Sharpe ratio. RiskLab converts it to a daily rate.',
  'Exceedances': 'Held-out days when the actual loss exceeded forecast VaR. Expected exceedances equal test days multiplied by one minus confidence.',
  'Stress test': 'Applies hypothetical price shocks to the selected holdings. Portfolio impact is the sum of each shock multiplied by its weight.',
  'Adjusted close': 'A closing price adjusted for events such as splits and dividends. RiskLab uses these values for its local historical series.',
  'Weight': 'A holding’s share of the portfolio’s latest total value. It determines how much that asset contributes to risk and stress results.',
  'Diversification': 'Spreading exposure across assets can reduce dependence on any one holding. Correlations can rise during a selloff.',
  'Rebalancing': 'Restoring target weights after prices move. This can control exposure and may incur tax or trading costs.',
  'Position sizing': 'Choosing how much capital to put in a holding. A larger weight makes that holding’s price changes matter more.',
  'Hedging': 'Taking an offsetting exposure to reduce a chosen risk. A hedge can cost money and may cover the exposure imperfectly.',
  'Emergency liquidity': 'Cash or accessible assets can cover spending without a forced sale. Holding more cash can reduce potential investment returns.',
};

export function Info({ term }) {
  const id = useId();
  const root = useRef(null);
  const [position, setPosition] = useState(null);
  const open = position !== null;
  useEffect(() => {
    if (!open) return;
    function outside(event) {
      if (!root.current?.contains(event.target)) setPosition(null);
    }
    function escape(event) {
      if (event.key === 'Escape') setPosition(null);
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return <span className="metric-info" ref={root}>
    <button type="button" aria-label={'About ' + term} aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition(open ? null : {
          left: Math.max(12, Math.min(rect.left, window.innerWidth - 292)),
          ...(window.innerHeight - rect.bottom > 155
            ? { top: rect.bottom + 7 } : { bottom: window.innerHeight - rect.top + 7 }),
        });
      }}>i</button>
    {open && <span id={id} className="metric-definition" style={position} role="status">{terms[term]}</span>}
  </span>;
}

const strategies = [
  ['Diversification', 'A single 20% position dropping 25% subtracts five percentage points from the portfolio if other prices hold steady.'],
  ['Rebalancing', 'If a 50% target position drifts to 60%, rebalancing brings it back toward the target.'],
  ['Position sizing', 'Cutting a holding from 20% to 10% halves its direct contribution to a given shock.'],
  ['Hedging', 'A broad index hedge can offset part of a market decline while leaving company-specific exposure.'],
  ['Emergency liquidity', 'A cash reserve can cover expenses during a downturn without selling volatile holdings.'],
];

export function Learn() {
  const [query, setQuery] = useState('');
  const [weight, setWeight] = useState('20');
  const [shock, setShock] = useState('-25');
  const results = Object.entries(terms).filter(([term, text]) =>
    (term + ' ' + text).toLowerCase().includes(query.trim().toLowerCase()));
  const valid = weight !== '' && shock !== '' && Number(weight) >= 0 && Number(weight) <= 100 && Number(shock) >= -100;
  return <section id="learn" className="panel wide learn">
    <h2>About RiskLab</h2>
    <p>RiskLab helps you compare estimates of daily price swings and see how losses might affect your holdings. Its forecasts use historical adjusted closes and are assessed on later, held-out trading days.</p>
    <p>Naive provides a baseline, HAR fits a linear regression, GARCH tracks changing variance, and MLP learns a nonlinear relationship from historical volatility. RiskLab is for research and education. It does not provide personalized financial advice.</p>
    <h3>How to use RiskLab</h3>
    <ol>
      <li>Pick a forecast ticker. Compare each model with realized volatility and check MAE or RMSE below the chart.</li>
      <li>Create a portfolio and enter shares and average cost to view its simulated balance and holdings.</li>
      <li>Choose a confidence level, compare VaR and CVaR, then try a stress scenario and check backtest exceedances.</li>
    </ol>
    <h3>Risk Management Academy</h3>
    <div className="strategy-grid">{strategies.map(([title, example]) => <article key={title}>
      <h4>{title}</h4><p>{terms[title]}</p><p className="muted">{example}</p>
    </article>)}</div>
    <h3>Position shock calculator</h3>
    <div className="shock-calculator">
      <label className="field">Portfolio weight (%)<input type="number" min="0" max="100" value={weight} onChange={(event) => setWeight(event.target.value)} /></label>
      <label className="field">Asset price change (%)<input type="number" min="-100" value={shock} onChange={(event) => setShock(event.target.value)} /></label>
      <output>{valid ? (Number(weight) * Number(shock) / 100).toFixed(2) + '% portfolio change' : 'Enter a valid weight and shock.'}</output>
    </div>
    <p className="muted">Assumes the rest of the portfolio is flat.</p>
    <h3>Financial glossary</h3>
    <label className="field ticker-search">Search definitions<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <dl className="glossary">{results.map(([term, definition]) => <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}</dl>
    {!results.length && <p> No matching terms.</p>}
  </section>;
}
