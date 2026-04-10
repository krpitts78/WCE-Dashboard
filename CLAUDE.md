# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-file ad spend & margin dashboard for **WCE (Wholesale Caps & Embroidery)**. Everything (HTML, CSS, JS) lives in `index.html` — no build system, bundler, or framework. Open the file directly in a browser to run it.

Pulls live data from a published Google Sheet via CSV export (no API key needed). The sheet contains monthly ad spend, revenue, COGS, and customer data.

## Data Flow

### Google Sheet → CSV → Dashboard
1. `loadData()` fetches CSV from `CSV_URL` (constructed from `SPREADSHEET_ID` + `GID` constants)
2. `Papa.parse()` (PapaParse CDN) parses CSV into raw rows
3. `parseSheet()` walks rows sequentially, detecting section headers to extract:
   - **KPI summary row** — triggered by finding `TOTAL REVENUE` in column B
   - **Monthly data table** — triggered by `Month` + `Orders` header row; collects rows matching `MONTHS_ORDER`
   - **Totals row** — triggered by `Total` or `Avg` prefix, ends monthly section
   - **Conversions by Source** — triggered by section header, collects source/count pairs
   - **New vs Returning** — triggered by section header, collects per-month customer split
4. Parsed data stored in global `D` object: `{ kpi, monthly[], totals, convSource[], newRet[] }`

### Month System
- `MONTHS_ORDER` defines the canonical month sequence: July 2025 → April 2026
- `MONTH_META` maps each month name to `{ year, quarter, YYYY-MM value }` for filtering
- Month names in the sheet must match `MONTHS_ORDER` entries exactly (e.g., `July`, `Aug`, `Sep`)

## Filter System

Preset-based filtering via pill buttons in the sticky filter bar:
- All Time, This Month, Prev Month, Q3–Q2 quarters, YTD, Custom date range
- `getFilteredMonths(preset, from, to)` returns filtered subset of `D.monthly`
- `computeKPIs(months)` recalculates all KPI values from filtered months (doesn't use pre-parsed summary)
- `renderAll(from, to)` is the main re-render entry point after any filter change

## Charts (Chart.js 4.4)

9 charts rendered via helper `mk(id, type, data, opts)` which destroys/recreates Chart.js instances stored in `charts{}`:

| Chart | Type | Data |
|---|---|---|
| Monthly Revenue | bar | revenue by month, highlights max month in green |
| ROAS by Month | line/filled | return on ad spend |
| Gross Margin % | line/filled | margin with red/green point coloring |
| Gross Profit/Loss | bar | red for negative, green for positive |
| Ad Spend Google vs Meta | stacked bar | two datasets |
| Orders by Month | bar | order count |
| New vs Returning | stacked bar | customer split |
| Conversions by Source | doughnut | always shows current month (not filtered) |
| Avg Order Value | line/filled | AOV trend |

`baseOpts(ytickFn, tooltipFn)` provides shared chart options (grid colors, tick styling).

## KPI Cards

8 cards in a responsive grid: Total Revenue, Total Orders, AOV, Total Gross Profit, Avg Gross Margin, Avg ROAS, Total Mkt Spend, Avg Mkt % of Revenue. Profit card dynamically colors red/green based on value.

## Monthly Breakdown Table

Sortable table with 15 columns per month. Includes a computed totals/averages row when multiple months are shown. Cells color-coded: ROAS (≥3x green, <2x red), Margin (>10% green, <0 red), Profit (positive green, negative red).

## Key Helpers

- `pv(str)` — parses formatted values like `$1,234.56`, `(123)`, `2.5x`, `45%` into numbers; handles negatives in parens
- `fc(n, decimals)` — formats number as USD currency
- `shortCurrency(v)` — abbreviated format ($1.2M, $45K)
- `setText(id, val)` — sets element text content by ID

## Dependencies (CDN)

- Chart.js 4.4.0
- PapaParse 5.4.1

## Styling

- Dark theme with CSS custom properties (`:root` vars)
- Color palette: green (#10b981), blue (#3b82f6), purple (#8b5cf6), amber (#f59e0b), red (#ef4444), pink (#ec4899)
- Font: Segoe UI / system-ui
- Sticky top bar + filter bar (z-index 100/99)
- Responsive grid breakpoints at 1400px and 700px
