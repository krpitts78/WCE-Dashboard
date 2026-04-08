# WCE Online Sales Dashboard

A single-file HTML dashboard for visualizing WCE online sales data from a Google Sheet. No backend, no build step — just open `index.html` in a browser.

## Features

- **Live data** pulled from a published Google Sheet via CSV (no API key required)
- **KPI cards** — Total Revenue, Orders, Avg Order Value, Units Sold, Unique Customers, Categories
- **Charts**
  - Revenue Over Time (line, auto-grouped by month)
  - Revenue by Category (doughnut)
  - Revenue by Region (horizontal bar)
  - Orders by Channel (bar)
  - Top Products & Top Customers (ranked lists)
- **Interactive table** — search, filter by category/region/status, sortable columns, pagination
- **Smart cell formatting** — currency, dates, status badges, color-coded values

## Setup

### 1. Publish the Google Sheet as CSV

1. Open the Google Sheet
2. Go to **File → Share → Publish to web**
3. Select the target tab → choose **CSV** → click **Publish**

### 2. Get your Sheet Tab GID

Click the tab you want to display. The URL will contain `&gid=XXXXXXXXX` — copy that number.

### 3. Configure the dashboard

Open `index.html` and update the constants near the top of the `<script>` block:

```js
const SPREADSHEET_ID = "1mjzGs7BwVLm4MmwH9dI9duYHW1zO4nMIpRcc_epnU9A";
const GID            = "0";   // ← Replace with your tab's GID
```

### 4. Open in a browser

Double-click `index.html` or serve it with any static file server. No installation needed.

## Column Mapping

The dashboard auto-detects common column header names. If your headers differ, update `COLUMN_MAP` in the script:

| Field | Recognized headers (examples) |
|---|---|
| `date` | Date, Order Date, Sale Date, Transaction Date |
| `revenue` | Revenue, Total, Amount, Sales, Order Total |
| `category` | Category, Product Category, Type, Line |
| `region` | Region, Area, Territory, State, Zone |
| `channel` | Channel, Sales Channel, Source, Platform |
| `customer` | Customer, Customer Name, Client, Buyer |
| `product` | Product, Product Name, Item, Description |
| `quantity` | Quantity, Qty, Units, Count |
| `status` | Status, Order Status, Fulfillment |

## Dependencies (loaded via CDN)

- [Chart.js 4.4](https://www.chartjs.org/)
- [PapaParse 5.4](https://www.papaparse.com/)
- [chartjs-adapter-date-fns](https://github.com/chartjs/chartjs-adapter-date-fns)
