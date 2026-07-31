# Deployment

This doc covers hosting, environment configuration, and authentication for **Our Family Money**. For what the app does and how to run it locally, see the [README](./README.md).

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

## Running the full stack locally

A plain `npm run dev` has no auth backend, since live mode relies on Azure Static Web Apps authentication (`/.auth/*`) and the Functions API. To run the real thing locally, use the [Azure Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/):

```bash
swa start http://localhost:5173 --run "npm run dev" --api-location api
```

(For a quick look without auth or a backend, use demo mode — see the README's Getting Started section.)

---

## Deploying to Azure

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

## Authentication

Live mode uses Azure Static Web Apps authentication. Only users with the `family` role can access and save data. The React routes are:

- `/login` — choose GitHub or Microsoft sign-in.
- `/access-denied` — signed-in accounts without the `family` role.

Logout goes to `/.auth/logout`. Microsoft/GitHub may keep their own session active, so returning may not always require re-entering credentials. Demo mode bypasses all of this.

---

## Tech stack

- **React 19** + **React Router 7** (single-page app)
- **Vite** build tooling
- **Bootstrap 5** for layout/styling
- **Chart.js** (via `react-chartjs-2`) for the dashboard charts
- **lucide-react** icons and **emoji-picker-react** for the emoji picker
- **Azure Static Web Apps** hosting + **Azure Functions** (Node) API for reading/writing the data file
- **GitHub-backed JSON** as the only data store
