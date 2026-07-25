# Changelog

Notable changes to **Runway** (the Budgeter web app), grouped by feature release. Smaller
patch fixes are summarized within the release they shipped under rather than listed separately.
Versions follow [Semantic Versioning](https://semver.org/): the middle number is a feature
release, the last is a small fix.

Live app: https://bston97.github.io/Budgeter/

## [1.7.0] — 2026-07-24

### Added
- **Shared Settle-up ledger.** The Settle-up tab can now be a single record shared between two specific accounts — editable and visible **only** to those accounts (enforced in Supabase). Everyone else keeps their own private settle-up automatically. Both participants are **named** (editable in-app), so the labels read correctly for whoever is viewing it (e.g. "Brandon paid — Maria owes Brandon"), and edits sync between the two like the rest of the app. Requires a one-time Supabase table + allowlist setup.

## [1.6.0] — 2026-07-24

### Added
- **Link a one-off payment to a credit card.** Each extra payment on the Runway tab now has an "Apply to" card picker that **auto-suggests** the right card from what you type (e.g. "Apple Card payment" → Apple Card), and you can override it. When linked, it shows a read-only **"→ [Card] after: $X"** preview of that card's balance once the payment lands. The preview updates live as you change the amount or the card's balance. (Credit cards now carry a hidden stable ID so links survive renames.)

### Fixed
- Multiple one-off payments linked to the same card now show a **cumulative** running balance instead of each ignoring the others.
- A card with no balance entered no longer shows a misleading negative "after" preview.
- Renaming a credit card now relabels the "Apply to" dropdowns immediately.
- Auto-suggest now matches whole words only, so a description like "discovery…" no longer mislinks to a "Discover" card.
- Editing an asset's value now updates just that row's date/trend in place, so an immediately following click (delete, type dropdown) isn't swallowed by a re-render.

## [1.5.0] — 2026-07-24

### Added
- **Asset types.** Each asset now has a type that drives its "as of" column:
  - **Report** (car, property): an editable date you set — e.g. from a Carfax report.
  - **Account** (savings, 401k): a read-only date that auto-stamps whenever the value changes.
  - **Investment** (Robinhood, Acorns): the same auto-date (smaller) plus a **▲/▼ trend arrow** showing whether the value went up or down since its last change.
- The whole assets section reflows to two rows per item on narrow/phone screens so nothing gets cramped.

## [1.4.0] — 2026-07-24

### Added
- **"Last checked" date on the credit score** — record when you actually pulled your score; the card shows it as "… · as of Jul 20, 2026" so you know how fresh the number is.
- **Optional "as of" date per asset** — each asset row now has a date field (e.g. for a car valued from a Carfax report on a given date). Credit cards and loans are unchanged.

## [1.3.0] — 2026-07-24

### Added
- **Extra payments this period** section on the Runway tab — log one-off amounts (like a variable credit-card payment) that get held against your available cash until your next payday. They **auto-clear** once that payday passes, and show on the timeline as one-off payments.
- **End-of-month bills** — each bill row now has an **EOM** toggle so a bill can be due at the end of the month (dynamically resolving to the 28th–31st) instead of a fixed day.

### Fixed
- "Reset all data" now spells out everything it clears (including the credit score and the Settle-up ledger with Maria), so nothing is wiped by surprise.
- One-off payments now also expire mid-session if a payday passes while the app is left open — not just on reload.
- Turning an **EOM** bill back to a numbered day restores the day you had before, instead of blanking it.
- The due-day field is clamped to 1–31 as you type (a stray `0` or `45` no longer silently drops or mis-schedules a bill).
- Amounts near zero no longer render as "-$0.00".
- Skipped a redundant cloud write on load, and the app now refreshes from the cloud when you return to the tab (with nothing unsaved), so edits made on another device show up sooner.
- Added visible keyboard-focus outlines and left/right arrow-key navigation between tabs.

## [1.2.0] — 2026-07-24

### Added
- **Credit score card** on the Net worth tab, sharing the top row with the net-worth summary. Shows your score, a Poor→Excellent rating, and a color gauge with a marker positioned across the 300–850 range.
- **"End of month" payday label** — when the next payday is the last day of the month, the Runway tab now says e.g. "End of July" instead of a fixed date, since month lengths vary.

### Fixed
- The Set/Change-password panel no longer shows on its own — it stayed visible because a CSS rule was overriding the hidden state.
- The password control now reliably reads **"Change password"** once you've signed in with (or set) a password.

## [1.1.0] — 2026-07-24

### Added
- **Email + password sign-in**, so you no longer open a second tab from an email link each time. Includes an in-app **Set / Change password** control (type it twice to confirm, auto-hides after saving), with magic link kept as a fallback and a **Forgot password?** reset option.

## [1.0.0] — 2026-07-24

### Added
- First full version: **Runway** (cash to next paycheck), **Net worth** (debts & assets), and **Settle up** (a ledger with Maria). Cloud-synced across devices via Supabase with magic-link sign-in, light/dark themes, and offline caching. Hosted on GitHub Pages.

### Fixed
- Post-launch reliability pass: added the mobile viewport/document head (fixes phone scaling), made cloud saves retry on failure and flush when leaving the page, cleared cached data on sign-out, and corrected card spacing on the Net worth and Settle up tabs.
