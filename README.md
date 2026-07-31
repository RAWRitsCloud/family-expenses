<p align="center">
  <img src="./src/assets/icon-192.png" alt="Our Family Money logo" width="96">
</p>

<h1 align="center">Our Family Money</h1>

<p align="center">
  A small, GitHub-backed family expense tracker for expected monthly child costs.
</p>

<p align="center">
  <a href="https://expenses-demo.rawritscloud.com"><strong>View the demo →</strong></a>
</p>

Our Family Money tracks expected monthly family costs, shows who pays what, groups spending by child and category, and keeps an optional log of actual payments under each expense.

There is no database. The source of truth is a single JSON file, so changes are easy to review, back up, and undo.

This public repository is safe to share: the committed `src/data/expenses.json` file contains fake demo data only. A private live deployment points the API at a separate private GitHub repository (or private JSON path) using Azure app settings.

---

## What it does

- Shows the monthly total for family expenses and the yearly projection.
- Splits each cost between the configured payers.
- Groups expenses by child and by category, with a categories bar chart and a contributor split.
- Lets you **record and delete payment entries** inline from the dashboard (date, description, amount).
- **Sortable** dashboard table (Expense / For / Category / Monthly), defaulting to expense name A→Z; a card layout on mobile.
- An **editor** for expenses, categories, and family, plus a raw **JSON editor** for bulk fixes.
- Saves approved changes back to **GitHub** in live mode, with an unsaved-changes prompt on exit.
- Runs as a **public demo** (no sign-in) that keeps edits in the browser session and never touches the repository.
- Uses **Azure Static Web Apps authentication** for family-only access in live mode.

---

## Tech stack

- **React 19** + **React Router 7** (single-page app)
- **Vite** build tooling
- **Bootstrap 5** for layout/styling
- **Chart.js** (via `react-chartjs-2`) for the dashboard charts
- **lucide-react** icons
- **Azure Static Web Apps** hosting + **Azure Functions** (Node) API for reading/writing the data file
- **GitHub-backed JSON** as the only data store

---

## Getting started

```bash
npm install
npm run dev
```

Because live mode relies on Azure Static Web Apps authentication (`/.auth/*`) and the Functions API, a plain `npm run dev` has no auth backend and will redirect to the login screen. Two ways to run locally:

**1. Demo mode (quickest — no auth, bundled data):**

```bash
# PowerShell
$env:VITE_APP_MODE="demo"; npm run dev
```

or add a `.env.local` file:

```text
VITE_APP_MODE=demo
```

**2. Full stack with auth + API** — use the [Azure Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/):

```bash
swa start http://localhost:5173 --run "npm run dev" --api-location api
```

Other scripts:

```bash
npm run build     # production build to dist/
npm run preview   # serve the built dist/
npm run lint      # eslint
```

---

## Live vs demo mode

The same codebase runs in two modes, decided at deploy time:

| | Live | Demo |
|---|---|---|
| Auth | Azure SWA, `family` role required | Open to everyone |
| Data source | Configured GitHub JSON file (via API) | Bundled `src/data/expenses.json` |
| Saving | Commits back to GitHub | Kept in `sessionStorage` for the tab/session |
| SWA config | `staticwebapp.config.live.json` | `staticwebapp.config.demo.json` |

Mode is signalled to the client by `window.FAMILY_EXPENSES_APP_MODE` (written into `dist/assets/runtime-config.js` at deploy time) or the build-time `VITE_APP_MODE` env var. Anything not explicitly `"demo"` is treated as secure **live** mode, and `src/components/ProtectedRoute.jsx` only skips sign-in when demo mode is active.

When `GITHUB_TOKEN`, `GITHUB_OWNER`, or `GITHUB_REPO` is missing on the server:

- `GET /api/expenses` returns the bundled fake demo data.
- `PUT /api/expenses` validates the edited data and returns success **without** writing to GitHub.
- The browser keeps demo edits in `sessionStorage`, so the dashboard and editor stay in sync for that session.

---

## Deployment

Deployment is via two GitHub Actions workflows to two Azure Static Web Apps:

- `.github/workflows/azure-static-web-apps-polite-mushroom-*.yml` — the **live** app.
- `.github/workflows/azure-static-web-apps-lively-moss-*.yml` — the public **demo** app.

Both build the Vite app themselves, copy the appropriate `staticwebapp.config.*.json` into `dist/`, write `runtime-config.js` with the mode, then deploy the pre-built `dist` (`skip_app_build: true`, `app_location: dist`).

To enable real GitHub saving on the **live** Static Web App, set these Application settings (Azure Portal → your SWA → Configuration):

| Setting | Required | Default | Notes |
|---|---|---|---|
| `GITHUB_TOKEN` | ✅ | — | Token with `contents: read/write` on the data repo |
| `GITHUB_OWNER` | ✅ | — | Repo owner/org |
| `GITHUB_REPO` | ✅ | — | Repo holding the JSON data |
| `GITHUB_BRANCH` | – | `main` | Branch to read/write |
| `GITHUB_DATA_PATH` | – | `data/expenses.json` | Path to the JSON file in that repo |
| `DEMO_DATA_PATH` | – | — | Optional override for the local demo fallback file |

Leave these unset on the demo Static Web App so it stays in demo mode.

---

## Data model

`src/data/expenses.json` is one JSON object with three required top-level sections:

- `family` — the children and payers the app should know about.
- `categories` — the managed category list, including emoji and chart colour.
- `expenses` — the monthly costs and any logged payment entries.

Minimal example:

```json
{
  "family": {
    "children": [
      { "id": "child-one", "name": "Child One", "initial": "C", "color": "#2563eb" }
    ],
    "payers": [
      { "id": "payer-one", "name": "Payer One", "initial": "J", "color": "#2563eb" },
      { "id": "payer-two", "name": "Payer Two", "initial": "D", "color": "#7c3aed" }
    ]
  },
  "categories": [
    { "name": "Category One", "emoji": "🎒", "color": "#2563eb" }
  ],
  "expenses": [
    {
      "name": "Example Monthly Cost",
      "emoji": "📌",
      "children": ["child-one"],
      "category": "Category One",
      "monthlyCost": 39.19,
      "paidBy": { "payer-one": 39.19, "payer-two": 0 },
      "entries": [
        { "date": "2026-07-10", "description": "Example one-off payment", "amount": 156.77 }
      ]
    }
  ]
}
```

### Family

Children and payers are managed at the top of the file. The app builds the dashboard cards, filters, and editor from these arrays. Use stable lowercase `id`s in expenses, and edit display `name`/`color` here.

### Categories

Categories are managed separately from expenses so their `emoji` and chart `color` stay consistent. If you add a new category name to an expense in raw JSON, also add it to the `categories` list.

### Expenses

Each expense is an expected monthly cost:

- `children` is always an array of child IDs (even for one child).
- `category` should match a managed category name.
- `monthlyCost` is the expected monthly average.
- `paidBy` uses payer IDs as keys; values should add up to `monthlyCost`.
- `emoji` is the emoji for this specific expense (the category has its own too).
- `entries` is optional history and does **not** change the monthly average.

### Entries

Entries are real/logged payments under an existing expense — camp balances, term passes, one-off kit payments, etc. Each has a `date` (`YYYY-MM-DD`), a `description`, and an `amount`. On the dashboard, entries are shown newest-first and can be recorded or deleted inline.

---

## Dashboard

- Summary cards per child, a **categories bar chart**, and a **contributor split** with percentages.
- Filter the expense list by child and by category.
- **Desktop:** a sortable table — click **Expense / For / Category / Monthly** to sort (default: expense name A→Z).
- **Mobile:** each expense is a card with its badges and payer split.
- Every expense expands to show its **payment entries**, where you can **Record payment** or delete an entry. Changes save immediately (GitHub in live mode, `sessionStorage` in demo).

---

## Editor

The editor has four pages, reached from the dashboard's **Add/Edit** button:

- **Expenses** — select/add/remove an expense; edit name, category, children, monthly cost, emoji, and the payer split (with "split evenly" / "X pays all" helpers and a one-off cost calculator that spreads a single payment across a number of months).
- **Categories** — names, emojis, and chart colours.
- **Family** — children and payers (name, initial, colour).
- **JSON editor** — direct bulk edits with formatting and validation.

Lists are shown alphabetically. Editing happens against a shared in-memory copy; the **Save to GitHub** button persists it (live), or stores it for the session (demo). Leaving the editor with unsaved changes shows a styled in-app prompt to save, discard, or keep editing.

---

## Authentication

Live mode uses Azure Static Web Apps authentication. Only users with the `family` role can access and save data. The React routes are:

- `/login` — choose GitHub or Microsoft sign-in.
- `/access-denied` — signed-in accounts without the `family` role.

Logout goes to `/.auth/logout`. Microsoft/GitHub may keep their own session active, so returning may not always require re-entering credentials. Demo mode bypasses all of this.

---

## Design goals

The project aims to stay simple, fast, mobile-friendly, database-free, and easy to review through GitHub history. It answers one question:

> What are our expected monthly family expenses, and who is paying what?

It is not trying to become a full budgeting app.

---

## License

Released under the MIT License.
