# Trading Bauhaus Screenshot Suite

This directory contains the 8 automated live-rendered screenshots of the **Trading Bauhaus — Interactive Trade Journal Dashboard** (`site/`), captured over headless Google Chrome DevTools Protocol (CDP) by `scripts/capture-screenshots.mjs` (included in `annoris/trading-bauhaus-journal-pro`).

All figures visible across these screens come from the deterministic, fictional **NQ / MNQ Prop Evaluation** sample dataset (51 closed futures round-trip trades across October–November 2026) running entirely client-side with zero external brokerage connections or real capital.

## Captured Screenshots

| File                                                     | Viewport           | Pixel Size | Captured State & Selector                           | Visual Focus                                                                                                                                                                                               |
| :------------------------------------------------------- | :----------------- | :--------- | :-------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`01-dashboard-overview.png`](01-dashboard-overview.png) | `1440×900` (`@1x`) | `1440×900` | `#view-dashboard` at scroll `y = 0`                 | Read-only yellow demo banner, workspace sidebar, Window/Symbol filter chips, Simulated AI Journal Analyst briefing + prompt chips, and 5 KPI cards including the 6-axis Edge Score v2 radar.               |
| [`02-trades-explorer.png`](02-trades-explorer.png)       | `1440×900` (`@1x`) | `1440×900` | `#workspace` (`#view=trades`)                       | Search, setup dropdown, outcome filters, sortable execution ledger (Date, Symbol, Side, Setup, Mistakes, Duration, Realized R, Net P&L), and per-row `Replay` trigger.                                     |
| [`03-trade-replay-modal.png`](03-trade-replay-modal.png) | `1440×900` (`@1x`) | `1440×900` | `<dialog id="trade-modal">` open                    | Native `<dialog>` candle replay modal showing entry/target/stop reference lines, BUY/SELL markers, bar-by-bar scrubber, simulated unrealized P&L, estimated MAE/MFE, playbook checklist, and review notes. |
| [`04-pnl-calendar.png`](04-pnl-calendar.png)             | `1440×900` (`@1x`) | `1440×900` | `#workspace` (`#view=calendar`, `2026-10`)          | Monthly Sun–Sat + Week summary heatmap with monthly performance insights and live Selected Session Inspector drilldown below the calendar grid.                                                            |
| [`05-reports-analytics.png`](05-reports-analytics.png)   | `1440×900` (`@1x`) | `1440×900` | `#workspace` (`#view=reports`, `Overview`)          | Seven statistical KPIs (Net P&L, Expectancy, Profit Factor, Sharpe, SQN, Max Drawdown, Recovery Factor), full-width equity curve, and zero-anchored daily net P&L bar chart.                               |
| [`06-setups-mistakes.png`](06-setups-mistakes.png)       | `1440×900` (`@1x`) | `1440×900` | `#workspace` (`#view=reports`, `Setups & Mistakes`) | Setup Performance Breakdown table (trades, win %, profit factor, avg R, net P&L per setup) paired with quantified Mistake Impact cards (`late entry`, `early exit`, `slipped stop`).                       |
| [`07-journal-prop-firms.png`](07-journal-prop-firms.png) | `1440×900` (`@1x`) | `1440×900` | `#workspace` (`#view=journal`)                      | Session selector list, structured Pre-Market Plan / Execution Review / Lesson blocks, clickable session trades, and the 6-rule NQ / MNQ Discipline Playbook with live adherence bars.                      |
| [`08-mobile-dashboard.png`](08-mobile-dashboard.png)     | `390×844` (`@2x`)  | `780×1688` | Mobile reload at `#view=dashboard`, `y = 0`         | Compact mobile header, yellow demo banner, scrollable workspace view switcher, full-width dark filter & AI review cards, and verified zero horizontal overflow (`scrollWidth <= innerWidth`).              |

## Automated Smoke Checks During Capture

Running `pnpm screenshots` also asserts live DOM and runtime behavior in headless Chrome:

1. **Direct Dashboard Load & Scope:** Asserts `#view-dashboard` renders immediately on load with `#demo-banner`, 5 KPI cards, and Edge Score v2 radar (with no legacy welcome section), and verifies timeframe filtering (`30D` ↔ `All`) dynamically updates the workspace scope pill.
2. **Trades & Candle Replay Flow:** Asserts `>= 10` rendered trade rows, opens `<dialog id="trade-modal">` with OHLC SVG candlesticks, advances replay steps via `#replay-restart-btn` and `#replay-step-btn`, and verifies `Escape` closes the dialog cleanly.
3. **Calendar, Reports & Prop Ledger:** Verifies active monthly calendar cells + Session Inspector, toggles Reports subtabs (`Overview`, `Setups & Mistakes`, `Trade Explorer` scatter SVG), and confirms fictional Prop Firms cash-ledger rows render.
4. **Privacy Mask & Theme Toggles:** Verifies `#privacy-toggle` masks dollar figures to `$••••`, `#theme-toggle` switches cleanly between `dark` and `light`, and mobile `390×844` reload keeps `#mobile-nav` closed with zero horizontal overflow.
5. **Zero Runtime Errors:** Fails on any `Runtime.exceptionThrown` or `console.error` event across the session.

## Regenerating Screenshots

Ensure **Node.js 22+** and **Google Chrome** are installed (override the binary path with `CHROME_PATH` if not located at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`):

```bash
pnpm screenshots
```
