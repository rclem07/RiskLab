# RiskLab

RiskLab is a local portfolio risk dashboard for research and education. It uses historical adjusted closing prices to compare daily volatility models, value user-defined holdings, and estimate how a portfolio might respond to adverse market moves.

## Features

| Area | What you can do |
| --- | --- |
| Portfolio tracking | Create named portfolios with share quantities and average costs. Review estimated value, the latest close-to-close change, a one-year balance simulation, and per-holding gains and losses. |
| Volatility and backtesting | Compare Naive, HAR, GARCH(1,1), and MLP forecasts. Toggle model lines, change the chart range, rank models by held-out RMSE, and compare observed and expected VaR exceedances. |
| Portfolio risk | Compare historical and normal one-day VaR and CVaR, annualized Sharpe ratio, cumulative return, and maximum drawdown. |
| Stress testing | Apply the 2008 crash, COVID crash, or rate shock preset, or enter a custom shock for each holding. |
| Reports and learning | Download a PDF risk report, open inline metric definitions, and explore a searchable glossary and position shock calculator. |
| Market context | Browse general market or ticker-specific headlines when a Finnhub key is configured. |

## Quick start on Windows

1. Install Python 3.11 or later and make sure `python` is available in your terminal.
2. From the RiskLab folder containing this README and `data/prices.csv`, double-click **Open Updated RiskLab.cmd**. The first launch installs missing Python dependencies. Building the frontend from source also requires Node.js 22.12 or later and npm.
3. Keep the terminal open. The launcher serves the dashboard and API from one local process and opens your browser when ready. If the browser stays closed, use the URL printed in the terminal. The launcher starts looking for an available port at 5175.
4. Enter a full name, username, and made-up password. The form is a demo sign-in. Use the same username, browser, and dashboard URL to retrieve saved portfolios.

Close the launcher window to stop RiskLab. If you edit frontend source, run `npm run build` in `frontend` before relaunching to update the served bundle.

## Development

Run the backend commands from the project root using an activated Python virtual environment.

```sh
python -m pip install -r requirements-dev.txt
python -m pytest
python -m uvicorn backend.main:app --reload
```

In a second terminal, start the frontend.

```sh
cd frontend
npm ci
npm run dev
```

Open the address printed by Vite, normally [localhost:5173](http://127.0.0.1:5173/). Vite forwards `/api` to FastAPI on port 8000. The [interactive API reference](http://127.0.0.1:8000/docs) documents request fields and responses. The pytest suite covers VaR, CVaR, Sharpe ratio, and drawdown.

## Data and configuration

**Historical prices.** The bundled Yahoo Finance snapshot covers January 2, 2015 through November 13, 2026. It contains 2,985 trading days for AAPL, MSFT, JPM, XOM, SPY, TSLA, NVDA, AMZN, META, and QQQ. Analytics read `data/prices.csv` locally at runtime. The balance and daily change reflect the latest close in that file.

To refresh the dataset, run the following from the project root. The downloader requests adjusted closes from January 1, 2015 through the current New York date, forward-fills gaps, and drops remaining incomplete rows.

```sh
python -m pip install -r requirements-data.txt
python scripts/fetch_data.py
```

**Optional headlines.** Stop RiskLab if it is running. In PowerShell 7, run the commands below from the project root to enter your key without displaying it and launch RiskLab in the same session.

```powershell
$env:FINNHUB_API_KEY = Read-Host "Finnhub API key" -MaskInput
& ".\Open Updated RiskLab.cmd"
```

In Windows PowerShell 5.1, replace the first line with:

```powershell
$env:FINNHUB_API_KEY = [System.Net.NetworkCredential]::new('', (Read-Host "Finnhub API key" -AsSecureString)).Password
```

The backend keeps the key out of browser responses and uses it only for news requests. Keep it out of source files. Market Context shows a setup message when the key is absent. [Finnhub dashboard](https://finnhub.io/dashboard)

## Methodology and scope

- **Forecasts.** Absolute daily log returns serve as a realized-volatility proxy. The first 80% of observations train the models and the remaining 20% form a chronological test period. Naive uses the previous day’s proxy. HAR regresses on lagged 1-, 5-, and 22-day averages. GARCH models conditional variance. MLP uses the same lagged inputs as HAR, with scaling fitted on training data.
- **Portfolio valuation.** The balance chart applies current share counts to historical adjusted closes. It represents a fixed-holdings simulation without past trades or cash flows. The holdings table compares estimated value with the entered cost basis.
- **Portfolio risk.** Latest holding values determine normalized long-only weights. Historical and normal VaR and CVaR use daily portfolio returns at those fixed weights. Sharpe annualizes daily excess-return statistics with 252 trading days, and drawdown measures the decline from the running peak of compounded wealth.
- **Backtesting and stress.** The VaR backtest uses the selected ticker’s held-out returns and a zero-mean normal threshold derived from each model’s forecast. Stress tests apply hypothetical shocks to current portfolio weights.
- **Local storage.** The demo sign-in accepts any nonblank credentials and discards the password. Portfolios persist in browser storage by username and origin. The app has no account service or database.

RiskLab is an educational and research tool. It does not provide personalized financial advice.

## Project layout

| Path | Purpose |
| --- | --- |
| `backend/` | FastAPI routes, forecasts, risk calculations, news, and PDF reports |
| `frontend/` | React dashboard, Recharts visualizations, and Vite build configuration |
| `scripts/` | Historical price download and local dashboard server |
| `data/` | Local price snapshot |
| `tests/` | Risk calculation tests |
