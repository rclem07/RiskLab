import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import './style.css';
import { Info, Learn } from './learn.jsx';

const tickers = ['AAPL', 'MSFT', 'JPM', 'XOM', 'SPY', 'TSLA', 'NVDA', 'AMZN', 'META', 'QQQ'];
const models = [
  ['naive', 'Naive', '#929292', '2 4'],
  ['har', 'HAR', '#dedede', '8 4'],
  ['garch', 'GARCH(1,1)', '#bcbcbc', '12 4 2 4'],
  ['mlp', 'MLP', '#dadada', '3 3 9 3'],
];
const actualColor = '#ffffff';
const seedValues = (value) => Object.fromEntries(tickers.map((ticker) => [ticker, value]));
const percent = (value, digits = 2) => (value * 100).toFixed(digits) + '%';
const axisPercent = (value) => percent(value, 1);
const shortDate = (value) => value.slice(0, 7);
const axis = { stroke: '#b0b0b0', fontSize: 11 };
const grid = '#2c2c2c';
const tooltip = { background: '#181818', border: '1px solid #454545', borderRadius: 4 };

function useApi(url, body, refresh) {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const key = JSON.stringify([url, payload, refresh]);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const options = { signal: controller.signal };
        if (payload !== undefined) {
          Object.assign(options, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
          });
        }
        const response = await fetch(url, options);
        const data = await response.json().catch(() => null);
        if (!response.ok || !data) {
          const detail = data?.detail;
          const message = Array.isArray(detail) ? detail.map((item) => item.msg).join(' ') : detail;
          throw new Error(message || 'The API returned HTTP ' + response.status + '. Check that FastAPI is running.');
        }
        if (!controller.signal.aborted) setResult({ key, data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, error: error.message });
      }
    }, payload === undefined ? 0 : 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, payload, key]);

  return url && result?.key === key ? result : { loading: Boolean(url) };
}

function Panel({ id, title, detail, result, children, className = '' }) {
  return (
    <section id={id} className={'panel ' + className}>
      <div className="panel-heading">
        <div><h2>{title}</h2><p>{detail}</p></div>
      </div>
      {result.loading && <p className="status" role="status">Loading…</p>}
      {result.error && <p className="status error" role="alert">{result.error}</p>}
      {result.data && children(result.data)}
    </section>
  );
}

function Forecast({ data }) {
  const [range, setRange] = useState('all');
  const [visible, setVisible] = useState(() => models.map(([key]) => key));
  const rows = data.dates.map((date, i) => ({
    date, actual: data.actual[i],
    ...Object.fromEntries(models.map(([model]) => [model, data.predictions[model][i]])),
  })).slice(range === 'all' ? 0 : -Number(range));
  const ranked = [...models].sort(([a], [b]) => data.metrics[a].rmse - data.metrics[b].rmse);
  return <>
    <div className="forecast-controls">
      <div className="toggle" aria-label="Visible forecast models">{models.map(([key, name]) =>
        <button key={key} type="button" aria-pressed={visible.includes(key)}
          onClick={() => setVisible(visible.includes(key) ? visible.filter((item) => item !== key) : [...visible, key])}>{name}</button>
      )}</div>
      <select aria-label="Chart date range" value={range} onChange={(event) => setRange(event.target.value)}>
        <option value="all">All test dates</option><option value="63">Latest 63 sessions</option>
        <option value="21">Latest 21 sessions</option>
      </select>
    </div>
    <div className="chart forecast-chart" aria-label="Actual and forecast daily volatility">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 14, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={30} tick={axis} />
          <YAxis tickFormatter={axisPercent} tick={axis} width={53} />
          <Tooltip contentStyle={tooltip} formatter={(value) => percent(value)} />
          <Legend />
          <Line dataKey="actual" name="Realized" stroke={actualColor} dot={false} strokeWidth={1.2} isAnimationActive={false} />
          {models.filter(([key]) => visible.includes(key)).map(([key, name, color, dash]) => (
            <Line key={key} dataKey={key} name={name} stroke={color} strokeDasharray={dash} dot={false} strokeWidth={1.8} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="table-wrap">
      <table aria-label="Forecast error metrics">
        <caption>Held-out model ranking by RMSE</caption>
        <thead><tr><th>Model</th><th>MAE <Info term="MAE" /></th><th>MSE (%²) <Info term="MSE" /></th><th>RMSE <Info term="RMSE" /></th><th>RMSE reduction vs. Naive</th></tr></thead>
        <tbody>{ranked.map(([key, name, color], index) => {
          const metric = data.metrics[key];
          const baseline = data.metrics.naive.rmse;
          return <tr key={key}>
            <th scope="row"><span className="dot" style={{ background: color }} />{name} <Info term={name} /> {index === 0 && <small>Lowest RMSE</small>}</th>
            <td>{percent(metric.mae)}</td><td>{(metric.mse * 10000).toFixed(3)}</td><td>{percent(metric.rmse)}</td>
            <td>{baseline ? percent(1 - metric.rmse / baseline, 1) : '—'}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </>;
}

function RiskCards({ data }) {
  return <div className="metric-grid">
    {['var', 'cvar'].map((key) => <div className="metric" key={key}>
      <h3>{key === 'var' ? 'VaR' : 'CVaR'} <Info term={key === 'var' ? 'VaR' : 'CVaR'} /></h3>
      <strong>{percent(data.historical[key])}</strong>
      <span>Historical <Info term="Historical" /></span>
      <div className="metric-secondary">Normal <Info term="Normal" /> <b>{percent(data.parametric[key])}</b></div>
    </div>)}
    <div className="metric"><h3>Sharpe ratio <Info term="Sharpe ratio" /></h3>
      <strong>{data.sharpe === null ? '—' : data.sharpe.toFixed(2)}</strong><span>Annualized</span>
    </div>
    <div className="metric"><h3>Max drawdown <Info term="Max drawdown" /></h3>
      <strong>{percent(data.max_drawdown)}</strong><span>Peak-to-trough loss</span>
    </div>
  </div>;
}

function Drawdown({ data }) {
  const [metric, setMetric] = useState('drawdown');
  const rows = data.dates.map((date, i) => ({ date, value: data[metric][i] }));
  const label = metric === 'drawdown' ? 'Drawdown' : 'Cumulative return';
  const color = '#dddddd';
  return <>
    <div className="toggle" aria-label="Performance series">
      {[['drawdown', 'Drawdown'], ['cumulative_return', 'Cumulative return']].map(([key, name]) => (
        <button key={key} type="button" aria-pressed={key === metric} onClick={() => setMetric(key)}>{name}</button>
      ))}
    </div>
    <div className="chart" aria-label={label + ' chart'}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={32} tick={axis} />
          <YAxis tickFormatter={axisPercent} tick={axis} width={58} />
          <Tooltip contentStyle={tooltip} formatter={(value) => percent(value)} />
          <Area name={label} dataKey="value" stroke={color} fill={color} fillOpacity={0.15} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </>;
}

function StressChart({ data }) {
  const rows = Object.entries(data.contributions).map(([ticker, loss]) => ({ ticker, loss }));
  return <>
    <div className="stress-total">
      <span>{data.loss < 0 ? 'Portfolio gain' : 'Portfolio loss'}</span> <strong>{percent(Math.abs(data.loss))}</strong>
    </div>
    <div className="chart stress-chart" aria-label="Weighted loss contribution by asset">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="ticker" tick={axis} />
          <YAxis tickFormatter={axisPercent} tick={axis} width={58} />
          <Tooltip contentStyle={tooltip} formatter={(value) => percent(value)} cursor={{ fill: '#ffffff0b' }} />
          <ReferenceLine y={0} stroke="#818181" />
          <Bar dataKey="loss" name="Loss contribution" maxBarSize={44} isAnimationActive={false}>
            {rows.map(({ ticker, loss }) => <Cell key={ticker} fill={loss >= 0 ? '#dedede' : '#888888'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </>;
}

function Backtest({ data }) {
  return <div className="table-wrap">
    <table aria-label="Value at Risk backtest">
      <thead><tr><th>Model</th><th>Exceedances <Info term="Exceedances" /></th><th>Expected</th><th>Rate</th></tr></thead>
      <tbody>{models.map(([key, name, color]) => {
        const row = data.models[key];
        return <tr key={key}>
          <th scope="row"><span className="dot" style={{ background: color }} />{name}</th>
          <td>{row.exceedances} / {data.observations}</td>
          <td>{row.expected_exceedances.toFixed(1)}</td><td>{percent(row.exceedance_rate)}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function loadPortfolios(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function PortfolioEditor({ draft, onChange, onSave, onCancel }) {
  const [search, setSearch] = useState('');
  const matches = tickers.filter((symbol) => symbol.includes(search.trim().toUpperCase()));
  const valid = draft.symbols.every((symbol) => {
    const position = draft.positions[symbol];
    return Number.isFinite(Number(position?.shares)) && Number(position.shares) > 0
      && position.cost !== '' && Number.isFinite(Number(position.cost)) && Number(position.cost) >= 0;
  });
  return <form className="portfolio-editor" onSubmit={(event) => {
    event.preventDefault();
    onSave();
  }}>
    <label className="field">Portfolio name
      <input value={draft.name} required maxLength={60}
        onChange={(event) => onChange({ ...draft, name: event.target.value })} />
    </label>
    <fieldset>
      <legend>Include tickers</legend>
      <label className="field ticker-search">Search tickers
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <div className="ticker-checks">
        {matches.map((symbol) => <label key={symbol}>
          <input type="checkbox" checked={draft.symbols.includes(symbol)} onChange={(event) => {
            const symbols = event.target.checked
              ? [...draft.symbols, symbol] : draft.symbols.filter((ticker) => ticker !== symbol);
            onChange({ ...draft, symbols });
          }} />{symbol}
        </label>)}
      </div>
      {!matches.length && <p className="muted">No supported tickers match.</p>}
    </fieldset>
    <div className="position-fields">
      {draft.symbols.map((symbol) => <fieldset key={symbol}>
        <legend>{symbol}</legend>
        {[['shares', 'Shares'], ['cost', 'Avg. cost per share ($)']].map(([key, label]) => (
          <label key={key} className="field">{label}
            <input type="number" min="0" step="any" required value={draft.positions[symbol]?.[key] ?? ''}
              onChange={(event) => onChange({ ...draft, positions: {
                ...draft.positions, [symbol]: { ...draft.positions[symbol], [key]: event.target.value },
              } })} />
          </label>
        ))}
      </fieldset>)}
    </div>
    <div className="portfolio-actions">
      <button type="submit" disabled={!draft.name.trim() || !draft.symbols.length || !valid}>Save portfolio</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const signedMoney = (value) => (value > 0 ? '+' : '') + usd.format(value);

function MarketContext({ ticker, refresh }) {
  const [mode, setMode] = useState('ticker');
  const news = useApi('/api/news' + (mode === 'ticker' ? '?ticker=' + ticker : ''), undefined, refresh);
  return <section id="news" className="panel wide">
    <div className="panel-heading"><div><h2>Market context</h2><p>Headlines from Finnhub</p></div>
      <label className="field news-filter">News filter
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="ticker">{ticker}</option><option value="market">General market</option>
        </select>
      </label>
    </div>
    {news.loading && <p role="status" className="status">Loading headlines…</p>}
    {news.error && <p role="alert" className="status error">{news.error}</p>}
    {news.data && (!news.data.configured ? <p className="muted">Set FINNHUB_API_KEY on the server to enable headlines.</p>
        : !news.data.articles.length ? <p className="muted">No headlines returned for this filter.</p>
        : <ul className="news-list">{news.data.articles.map((article, index) => <li key={article.url + index}>
          <a href={article.url}>{article.headline}</a>
          <p className="muted">{article.source} · {new Date(article.timestamp * 1000).toLocaleString()}</p>
        </li>)}</ul>)}
  </section>;
}

function Balance({ prices, positions }) {
  const last = prices.dates.length - 1;
  const holdings = Object.entries(positions).map(([symbol, { shares, cost }]) => {
    const price = prices.closes[symbol][last];
    const value = shares * price;
    return { symbol, shares, cost, price, value, gain: value - shares * cost };
  });
  const rows = prices.dates.map((date, index) => ({
    date, value: holdings.reduce((sum, item) => sum + item.shares * prices.closes[item.symbol][index], 0),
  }));
  const value = rows[last].value;
  const prior = rows[last - 1].value;
  return <>
    <div className="balance-summary">
      <strong>{usd.format(value)}</strong>
      <span>Latest day {signedMoney(value - prior)} ({percent((value - prior) / prior)})</span>
    </div>
    <div className="chart balance-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 10, right: 14, bottom: 0, left: 12 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={32} tick={axis} />
          <YAxis domain={['auto', 'auto']} tickFormatter={(amount) => '$' + amount.toLocaleString()} tick={axis} width={88} />
          <Tooltip contentStyle={tooltip} formatter={(amount) => usd.format(amount)} />
          <Area dataKey="value" name="Portfolio value" stroke="#eeeeee" fill="#eeeeee" fillOpacity={0.1} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <p className="muted">As of {prices.dates[last]}. History applies your current shares to adjusted closes.</p>
    <div className="table-wrap holdings-table">
      <table aria-label="Portfolio holdings">
        <thead><tr>{['Ticker', 'Shares', 'Avg. cost', 'Latest close', 'Value', 'Weight', 'Gain / loss'].map((label) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{holdings.map((item) => <tr key={item.symbol}>
          <th scope="row">{item.symbol}</th><td>{item.shares}</td><td>{usd.format(item.cost)}</td>
          <td>{usd.format(item.price)}</td><td>{usd.format(item.value)}</td>
          <td>{percent(item.value / value, 1)}</td><td>{signedMoney(item.gain)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}

function Dashboard({ profile, onSignOut }) {
  const [ticker, setTicker] = useState('SPY');
  const storageKey = 'risklab.portfolios.' + profile.username.toLowerCase();
  const [portfolios, setPortfolios] = useState(() => loadPortfolios(storageKey));
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState(null);
  const [storageError, setStorageError] = useState(false);
  const [confidence, setConfidence] = useState(95);
  const [rate, setRate] = useState('0');
  const [scenario, setScenario] = useState('2008 crash');
  const [shocks, setShocks] = useState(() => seedValues('-10'));
  const [refresh, setRefresh] = useState(0);
  const [reportState, setReportState] = useState('');

  const active = portfolios.find((portfolio) => portfolio.id === activeId);
  const prices = useApi('/api/prices', undefined, refresh);
  const positions = active?.positions;
  const holdings = Object.keys(positions ?? active?.weights ?? seedValues(1));
  const weights = positions && prices.data
    ? Object.fromEntries(holdings.map((symbol) => [symbol, positions[symbol].shares * prices.data.closes[symbol].at(-1)]))
    : active?.weights ?? seedValues(1);

  function savePortfolios(next) {
    setPortfolios(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }

  function saveDraft() {
    const name = draft.name.trim();
    if (!name || !draft.symbols.length) return;
    const previous = portfolios.find((portfolio) => portfolio.id === draft.id);
    const next = {
      id: draft.id ?? crypto.randomUUID(),
      name,
      positions: Object.fromEntries(draft.symbols.map((symbol) => [symbol, {
        shares: Number(draft.positions[symbol].shares), cost: Number(draft.positions[symbol].cost),
      }])),
    };
    savePortfolios(previous
      ? portfolios.map((portfolio) => portfolio.id === next.id ? next : portfolio)
      : [...portfolios, next]);
    setActiveId(next.id);
    setDraft(null);
  }

  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const weightError = positions && !prices.data
    ? prices.error || 'Waiting for adjusted closes.'
    : totalWeight <= 0 ? 'This portfolio needs a positive allocation.' : '';
  const rateError = rate === '' || !Number.isFinite(Number(rate)) || Number(rate) <= -100
    ? 'Enter a risk-free rate above −100%.' : '';
  const custom = scenario === 'custom';
  const shockError = custom && holdings.some((symbol) => {
    const value = shocks[symbol];
    return (
    value === '' || !Number.isFinite(Number(value)) || Number(value) < -100
    );
  }) ? 'Enter a shock of −100% or higher for each asset.' : '';
  const portfolioIssue = weightError || rateError;
  const stressIssue = weightError || shockError;

  const forecast = useApi('/api/forecast?ticker=' + ticker, undefined, refresh);
  const risk = useApi(portfolioIssue ? null : '/api/risk', {
    weights, confidence: confidence / 100, risk_free_rate: Number(rate) / 100,
  }, refresh);
  const backtest = useApi('/api/var-backtest?ticker=' + ticker + '&confidence=' + confidence / 100, undefined, refresh);
  const stressBody = {
    weights, scenario,
    ...(custom ? { shocks: Object.fromEntries(tickers.map((symbol) => [
      symbol, Object.hasOwn(weights, symbol) ? Number(shocks[symbol]) : 0,
    ])) } : {}),
  };
  const stress = useApi(stressIssue ? null : '/api/stress', stressBody, refresh);
  const riskResult = portfolioIssue ? { error: portfolioIssue } : risk;
  const stressResult = stressIssue ? { error: stressIssue } : stress;
  const apiError = [forecast, risk, stress, backtest, prices].some((result) => result.error);

  async function downloadReport() {
    setReportState('Preparing report…');
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...stressBody, ticker, confidence: confidence / 100, risk_free_rate: Number(rate) / 100 }),
      });
      if (!response.ok) throw new Error('Report unavailable. Check that the updated RiskLab server is running.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'risklab-report.pdf';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setReportState('');
    } catch (error) {
      setReportState(error.message);
    }
  }
  const scenarioControl = <select aria-label="Stress scenario" value={scenario} onChange={(e) => setScenario(e.target.value)}>
    <option>2008 crash</option><option>COVID crash</option><option>Rate shock</option><option value="custom">Custom</option>
  </select>;

  return <div className="app">
    <header className="topbar">
      <div className="brand">RiskLab</div>
      <span className="topbar-text">Portfolio Risk Analytics</span>
      {apiError && <button className="retry" onClick={() => setRefresh((count) => count + 1)}>Retry requests</button>}
      <div className="profile"><span title={'@' + profile.username}>{profile.name}</span>
        <button className="quiet" type="button" onClick={onSignOut}>Sign out</button>
      </div>
    </header>
        <nav className="dashboard-nav" aria-label="Dashboard sections">
          <a href="#overview">Overview</a>
          <a href="#models">Model comparison</a>
          <a href="#performance">Portfolio performance</a>
          <a href="#stress">Stress testing</a>
          <a href="#backtest">VaR backtest</a>
          <a href="#news">Market context</a>
          <a href="#learn">Learn</a>
        </nav>
    <div className="layout">
      <aside className="sidebar" aria-label="Dashboard settings">
        <h2>Settings</h2>
        <div className="portfolio-picker">
          <label className="field">Portfolio
            <select value={activeId} onChange={(event) => {
              setActiveId(event.target.value);
              setDraft(null);
            }}>
              <option value="">Default portfolio</option>
              {portfolios.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <div className="portfolio-actions">
            <button type="button" onClick={() => setDraft({ name: '', symbols: [], positions: {} })}>New portfolio</button>
            {active && <button type="button" onClick={() => setDraft({
              id: active.id, name: active.name, symbols: holdings, positions: active.positions ?? {},
            })}>Edit</button>}
          </div>
          {draft && <PortfolioEditor draft={draft} onChange={setDraft} onSave={saveDraft} onCancel={() => setDraft(null)} />}
          {storageError && <p className="status error" role="alert">Browser storage is unavailable. Changes last until you leave this page.</p>}
        </div>
        <label className="field">Forecast ticker
          <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
            {tickers.map((symbol) => <option key={symbol}>{symbol}</option>)}
          </select>
        </label>
        <div className="explained-field"><label className="field">Confidence
          <select value={confidence} onChange={(e) => setConfidence(Number(e.target.value))}>
            {[90, 95, 97.5, 99].map((value) => <option key={value} value={value}>{value}%</option>)}
          </select>
        </label><Info term="Confidence" /></div>
        <div className="explained-field"><label className="field">Annual risk-free rate (%)
          <input type="number" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label><Info term="Risk-free rate" /></div>
      </aside>
      <main id="overview">
        <div className="overview-heading"><h1>Overview</h1>
          <button type="button" className="retry" onClick={downloadReport}
            disabled={!forecast.data || !risk.data || !stress.data || reportState === 'Preparing report…'}>Download risk report</button>
        </div>
        {reportState && <p className="status" role="status">{reportState}</p>}
        <div className="dashboard">
          {positions ? <Panel title={active.name} detail="Portfolio balance" result={prices} className="wide">
            {(data) => <Balance prices={data} positions={positions} />}
          </Panel> : <section className="panel wide">
            <h2>{active?.name ?? 'Default portfolio'}</h2>
            <p className="muted">{active ? 'Edit this portfolio to enter shares and average costs.' : 'Create a portfolio to track its balance and holdings.'}</p>
          </section>}
          <Panel title="Portfolio risk" detail={(active?.name ?? 'Default portfolio') + ' · ' + confidence + '% confidence'}
            result={riskResult} className="wide">{(data) => <RiskCards data={data} />}</Panel>
          <Panel id="models" title={<>Volatility forecasts <Info term="Volatility" /></>} detail={ticker + ' · Held-out trading days · Daily volatility'}
            result={forecast} className="wide">{(data) => <Forecast data={data} />}</Panel>
          <Panel id="performance" title="Portfolio performance" detail="Compounded daily portfolio returns"
            result={riskResult}>{(data) => <Drawdown data={data} />}</Panel>
          <div id="stress" className="panel stress-panel">
            <div className="panel-heading"><div><h2>Stress test <Info term="Stress test" /></h2><p>Weighted price shocks</p></div>{scenarioControl}</div>
            {custom && <div className="shocks">{holdings.map((symbol) => <label key={symbol} className="field">
              {symbol} (%)<input type="number" min="-100" step="any" value={shocks[symbol]}
                onChange={(e) => setShocks({ ...shocks, [symbol]: e.target.value })} />
            </label>)}</div>}
            {stressResult.loading && <p className="status" role="status">Loading…</p>}
            {stressResult.error && <p className="status error" role="alert">{stressResult.error}</p>}
            {stressResult.data && <StressChart data={{
              ...stressResult.data,
              contributions: Object.fromEntries(holdings.map((symbol) => [symbol, stressResult.data.contributions[symbol]])),
            }} />}
          </div>
          <Panel id="backtest" title="VaR backtest" detail={ticker + ' · ' + confidence + '% confidence · Held-out trading days'}
            result={backtest} className="wide">{(data) => <Backtest data={data} />}</Panel>
          <MarketContext ticker={ticker} refresh={refresh} />
          <Learn />
        </div>
      </main>
    </div>
  </div>;
}

const illustration = Array.from({ length: 180 }, (_, i) => ({
  value: 0.08 + 0.018 * Math.sin(i * 1.72) + 0.012 * Math.cos(i * 2.7)
    + 0.28 * Math.exp(-Math.abs(i - 48) / 6)
    + 0.2 * Math.exp(-Math.abs(i - 120) / 4)
    + 0.1 * Math.exp(-Math.abs(i - 154) / 9),
}));

function SignIn({ onSignIn }) {
  const [signup, setSignup] = useState(false);
  const [error, setError] = useState('');

  function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const name = fields.get('fullName').trim();
    const username = fields.get('username').trim();
    if (!name || !username || !fields.get('password').trim()) {
      setError('Enter your full name, username, and password.');
      return;
    }
    onSignIn({ name, username });
  }

  return <main className="signin">
    <header className="signin-header"><div className="brand">RiskLab</div></header>
    <div className="signin-layout">
      <section className="signin-intro">
        <h1>Portfolio<br />Risk Analytics</h1>
        <div className="signin-figure" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={illustration} accessibilityLayer={false}>
              <CartesianGrid stroke="#252525" />
              <XAxis tick={false} />
              <YAxis tick={false} width={1} domain={[0, 0.44]} />
              <Line dataKey="value" stroke="#bdbdbd" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="signin-form" aria-labelledby="signin-title">
        <h2 id="signin-title">{signup ? 'Sign up' : 'Sign in'}</h2>
        {signup ? <>
          <p className="signin-note">Account creation is a preview. Use demo sign-in to open RiskLab.</p>
          <button className="signin-submit" onClick={() => setSignup(false)}>Back to sign in</button>
        </> : <form onSubmit={submit}>
          <label className="field">Full name<input name="fullName" autoComplete="off" required /></label>
          <label className="field">Username<input name="username" autoComplete="off" required /></label>
          <label className="field">Password<input name="password" type="password" autoComplete="off" required /></label>
          {error && <p className="error status" role="alert">{error}</p>}
          <button className="signin-submit" type="submit">Sign in</button>
          <div className="signin-footer">
            <p>Demo access. Use a made-up password.</p>
            <button className="quiet" type="button" onClick={() => { setError(''); setSignup(true); }}>Sign up</button>
          </div>
        </form>}
      </section>
    </div>
  </main>;
}

function Welcome({ name, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2800);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return <button type="button" className="welcome-overlay" onClick={onDismiss}
    onKeyDown={(event) => { if (event.key === 'Escape') onDismiss(); }}
    aria-label={`Welcome back, ${name}. Dismiss welcome.`} autoFocus>
    <span>Welcome back, {name}.</span>
  </button>;
}

function App() {
  const [profile, setProfile] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  if (!profile) return <SignIn onSignIn={(nextProfile) => {
    setProfile(nextProfile);
    setShowWelcome(true);
    window.scrollTo(0, 0);
  }} />;

  return <>
    <div inert={showWelcome}>
      <Dashboard profile={profile} onSignOut={() => {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setProfile(null);
        window.scrollTo(0, 0);
      }} />
    </div>
    {showWelcome && <Welcome name={profile.name} onDismiss={() => setShowWelcome(false)} />}
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
