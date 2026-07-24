# Changelog

All notable changes to **Runway** (the Budgeter web app) are recorded here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); versions follow [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH).

Live app: https://bston97.github.io/Budgeter/

## [Unreleased]

_Nothing yet — add notes here as changes land, then cut them into a new version._

## [1.0.0] — 2026-07-24

First full version: a cloud-synced personal budget app, live on GitHub Pages.

### Added
- **Runway tab** — cash until the next paycheck. Enter your checking balance and monthly bills (name, amount, due day); the app finds the next payday (15th and last day of each month), subtracts the bills due before then, and shows what's actually free to spend, a safe-to-spend-per-day figure, and a dated timeline of upcoming bills with a running balance.
- **Net worth tab** — Assets (Robinhood, 401(k), savings, etc.) minus Debts (credit cards + loans), with a net-worth total and an asset-vs-debt split bar.
- **Settle up tab** — a two-sided ledger with Maria: what you paid (she owes you) vs. what she paid (you owe her), the net difference showing who owes whom, plus separate "Last updated" (automatic) and "Last Venmo'd" (manual) trackers.
- **Cloud sync via Supabase** — data is stored in Postgres (one row per user, protected by Row Level Security) and syncs across all your devices.
- **Magic-link sign-in** — passwordless email login; no account/password to manage.
- **Offline cache** — browser localStorage keeps a copy so the app loads instantly and survives brief offline moments; a "Saved ✓" indicator shows sync status.
- **Light & dark themes** with a manual toggle.

### Infrastructure
- Moved the project out of OneDrive to `C:\Users\bston\Projects\Budgeter` (OneDrive was locking git operations).
- Set up a public GitHub repo (`bston97/Budgeter`) and deployed via GitHub Pages.
- Migrated storage from browser-only localStorage to Supabase for cross-device access.
