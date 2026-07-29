# Deployment guide

This project is designed to be deployed as an Azure Static Web App with a small Azure Function API.

There is no database. The app stores its data in a JSON file in GitHub.

## What gets deployed

The site is made from:

- `index.html` — dashboard
- `editor/expenses.html` — expense editor
- `editor/categories.html` — category editor
- `editor/family.html` — family editor
- `editor/json.html` — raw JSON editor
- `auth/login.html` — sign-in options
- `auth/access-denied.html` — signed-in users without the required role
- `auth/signed-out.html` — post-logout page
- `assets/` — JavaScript, CSS, icons
- `api/` — Azure Function used to read and save the GitHub JSON file
- `data/expenses.json` — local bundled fallback/example data

The repository contains two source Static Web App config files:

- `staticwebapp.config.live.json` — protected live routes;
- `staticwebapp.config.demo.json` — anonymous demo routes.

The GitHub workflow creates `staticwebapp.config.json` during each deployment job by copying the right environment file into place. `staticwebapp.config.json` is not committed.

## Source of truth

The live source of truth is a JSON file in a GitHub repository.

By default, the API expects:

```text
data/expenses.json
```

That default can be changed with the `GITHUB_DATA_PATH` setting.

The bundled `data/expenses.json` file is still useful because:

- it gives the project an example data file;
- it lets the dashboard show a local copy if the live GitHub read fails;
- it documents the expected JSON shape.

When the editor saves, it saves through the API to GitHub. It does not save back to the bundled static file directly.

## Required Azure Static Web App settings

Set these application settings in Azure:

| Setting | Required | Example | Notes |
|---|---:|---|---|
| `GITHUB_TOKEN` | Yes | `github_pat_...` | Token used by the API to read and write the JSON file. |
| `GITHUB_OWNER` | Yes | `example-owner` | GitHub account or organisation that owns the repo. |
| `GITHUB_REPO` | Yes | `family-expenses` | Repository containing the JSON file. |
| `GITHUB_BRANCH` | No | `main` | Defaults to `main` if omitted. |
| `GITHUB_DATA_PATH` | No | `data/expenses.json` | Defaults to `data/expenses.json` if omitted. |

The token needs permission to read and write the target repository contents.

For a public demo Static Web App, leave the GitHub settings blank. When `GITHUB_TOKEN`, `GITHUB_OWNER`, or `GITHUB_REPO` is missing, the API automatically behaves as a demo API:

- `GET /api/expenses` returns local bundled demo data where available;
- `PUT /api/expenses` validates changes and returns success without writing to GitHub.

The dashboard reads `/data/expenses.json` directly in demo mode, so it can show fake data immediately without waiting for the API.

Demo saves are kept in browser `sessionStorage`, so edits survive moving between the dashboard and editor, and survive refreshes in the same tab. They are not shared with other visitors and disappear when the browser session is cleared.

## Live and demo deployment

The same `main` branch deploys to both Static Web Apps.

The workflow has two deploy jobs that run in parallel:

- the live job copies `staticwebapp.config.live.json` to `staticwebapp.config.json` and deploys the protected live app;
- the demo job copies `staticwebapp.config.demo.json` to `staticwebapp.config.json` and deploys the anonymous demo app.

The demo app currently uses:

```text
https://lively-moss-0115bc403.7.azurestaticapps.net
```

## Authentication

The app uses Azure Static Web Apps authentication.

Routes are protected in `staticwebapp.config.live.json`.

Users need the `family` role to access the dashboard, editor, data route, and API.

Important protected routes:

```text
/
/editor/*
/data/*
/api/*
```

Public routes include:

```text
/auth/login.html
/auth/access-denied.html
/auth/signed-out.html
/app.webmanifest
```

## Adding users

In Azure Static Web Apps:

1. Open the Static Web App.
2. Go to Authentication / Role management.
3. Invite the user.
4. Assign the `family` role.

Without the `family` role, users should be redirected to the access-denied state.
Unauthenticated users are redirected to `/auth/login.html`.

For troubleshooting auth pages without automatic redirects, add:

```text
?debugAuth=1
```

For example:

```text
/auth/login.html?debugAuth=1
/auth/access-denied.html?debugAuth=1
```

## Changing where the JSON lives

To use a different JSON location, change the Azure app settings, not the code.

For example:

```text
GITHUB_OWNER=example-owner
GITHUB_REPO=household-costs
GITHUB_BRANCH=main
GITHUB_DATA_PATH=config/family-expenses.json
```

The front end calls the API. The API reads these settings and then talks to GitHub.

If GitHub is unavailable, the front end may fall back to the bundled static file:

```text
data/expenses.json
```

So if you want the fallback to match the live data shape, keep that file updated as a safe example copy.

## JSON structure

The JSON file must contain:

- `family`
- `categories`
- `expenses`

See `README.md` for the full anonymised JSON example and field descriptions.

## Save behaviour

When someone presses “Save to GitHub”:

1. The browser sends the edited JSON to `/api/expenses`.
2. The Azure Function validates the JSON shape.
3. The function reads the current GitHub file SHA.
4. The function commits the updated JSON back to GitHub.

If the GitHub write fails, the editor shows the error and keeps the user on the page.

## Local fallback behaviour

The live dashboard tries to load live data first.

If that fails, it falls back to:

```text
/data/expenses.json
```

The GitHub status panel on the dashboard should make it clear whether live GitHub data was used or whether the local copy was used.

## Deployment notes

- Do not commit secrets.
- Put GitHub credentials in Azure app settings only.
- Keep `data/expenses.json` valid even if it is only used as fallback/example data.
- If the JSON schema changes, update both `README.md` and the API validation.
- If you change route protection, update `staticwebapp.config.live.json` and `staticwebapp.config.demo.json`.

## Monthly redeploys

The site can still load live JSON without redeploying every time the data changes.

A periodic redeploy can be useful if you want the bundled fallback file and static assets refreshed occasionally, but the normal editor save flow does not require a deployment.
