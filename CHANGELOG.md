# Changelog

All notable changes to **Runway** (the Budgeter web app) are recorded here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); versions follow [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH).

Live app: https://bston97.github.io/Budgeter/

## [Unreleased]

_Nothing yet._

## [1.1.0] — 2026-07-24

### Added
- **Email + password sign-in.** Sign in directly on the same tab with a password — no more opening a second tab from an email link every time. Magic link is kept as a fallback ("Email me a magic link instead") and a "Forgot password?" reset option was added.
- **Set / change password** control in the app header (visible when signed in). Set a password on your existing account, then use email + password from then on. (First time: magic-link in once, then set a password.)

## [1.0.1] — 2026-07-24

### Fixed
- Added the standard document head (doctype, UTF-8 charset, and mobile **viewport** meta) that the standalone GitHub Pages site was missing after the move off Claude Artifacts — fixes page scaling on phones so the responsive single-column layout actually kicks in.
- Cloud saves now genuinely **retry** after a failure and when the connection returns, matching the "Offline — will retry" status (previously no retry ever happened).
- **Signing out clears the locally cached data**, so a different account signing in on the same browser no longer inherits or overwrites the previous user's data.
- **Pending edits are flushed** to the cloud when the tab is hidden or closed, so the last change before leaving isn't lost.
- Net worth and Settle up tabs: added spacing between the hero summary card and the grid of cards below it, so the card borders no longer touch the summary (matches the Runway tab).

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
