# TODO

Open work for **Penny Pincher**. Short entries — what and why, enough to act on without
context from wherever it was raised.

Companion to [ROADMAP.md](ROADMAP.md) (feature direction) and [ARCHITECTURE.md](ARCHITECTURE.md)
(structural work). This file is for loose ends: fixes, chores, and decisions, not features.

---

## Broken now — do this first

### `APP_URL` points at a dead URL after the repo rename

`index.html` line ~1241 still reads:

```
var APP_URL = "https://bston97.github.io/Budgeter/";
```

That URL now returns **404** — the repo was renamed to `penny-pincher`, and GitHub Pages did
**not** redirect the old Pages path. The live app is at `https://bston97.github.io/penny-pincher/`
(confirmed 200).

`APP_URL` is not decorative. It is passed as:

- `emailRedirectTo` for magic-link sign-in (`signInWithOtp`, ~line 3522)
- `redirectTo` for password reset (`resetPasswordForEmail`, ~line 3570)

So **magic-link sign-in and password reset currently land users on a 404 page.** Anyone
without a saved password may be locked out. Fix is a one-line change to the new URL.

Also check the Supabase Auth dashboard — the project's **Site URL** and **Redirect allow-list**
almost certainly still list the old `/Budgeter/` URL and need the new one added, or the
redirect will be rejected even after the code is fixed.

---

## Finish the Budgeter → Penny Pincher rename

The intent is to drop the "Budgeter" name entirely. Only the git remote was updated
(now `github.com/bston97/penny-pincher`). Still stale:

- `index.html:10` — `<meta name="apple-mobile-web-app-title" content="Budgeter" />`
- `manifest.json:3` — `"short_name": "Budgeter"`
- `ROADMAP.md:3` — "Penny Pincher (the Budgeter web app)"
- `ROADMAP.md:16` and `CHANGELOG.md:9` — `Live app:` links to the dead `/Budgeter/` URL
- `CHANGELOG.md:3` — "(the Budgeter web app, called Runway up to 1.18.1)"

Two deliberate exceptions — **do not "fix" these**:

- `CHANGELOG.md:133` is the historical 1.19.0 entry explaining the rename. It should keep
  saying Budgeter; it is a record of what happened.
- `index.html` `var KEY = "runway.budget.v1"` is the localStorage key, intentionally left at
  the pre-rename value. Changing it orphans every existing cache and loses anything not yet
  synced. The comment above it says so.

Note the home-screen icon caption was *deliberately* "Budgeter" because the full name is too
wide for a phone icon caption (see CHANGELOG 1.19.0). If the name is going away entirely,
pick a replacement short name that fits — "Penny" is the obvious candidate.

---

## Missing standard repo files

None of these exist. Listed for a decision rather than created, since the license especially
is a judgement call:

- **`README.md`** — nothing currently explains what the app is, that it's a static site
  deployed from `main` via GitHub Pages, or how to run the tests (`node --test tests/core.test.mjs`).
  A repo visitor sees only a changelog and a roadmap.
- **`LICENSE`** — absent, which by default means all rights reserved. Fine if deliberate, but
  worth choosing on purpose. **Your call.**
- `.gitignore` — exists and is adequate.
- `CONTRIBUTING.md` / `SECURITY.md` / issue templates — not warranted for a solo project.

---

## Chores

### `logo.png` is 1.19 MB and referenced nowhere

Largest tracked file by a wide margin (next biggest is `icon-512.png` at 218 KB). No reference
to it in any HTML, JSON, JS, or Markdown. It may be the source asset the icons were exported
from — check before deleting, and if that's what it is, consider whether it belongs in the
deployed repo at all, since GitHub Pages serves the whole tree.

### Confirm RLS is enforced on the Supabase ledger table

`SB_KEY` in `index.html` is a **publishable** key (`sb_publishable_…`), which is designed to
ship in client code — not a leak. But that is only true while row-level security is actually
enforced on the data tables; the publishable key is exactly as safe as the RLS policies behind
it. Worth confirming in the Supabase dashboard (or via `get_advisors`) rather than assuming,
since every user's finances sit behind it.

---

## Account integrations

See [ACCOUNT-INTEGRATIONS.md](ACCOUNT-INTEGRATIONS.md) for the full thinking. The concrete
next step recorded there, repeated so it isn't lost:

- Research **two** providers (Plaid and Teller are the shortlist) — real pricing at personal
  volume, and whether a hobby/personal project is permitted under their terms.
- Answer the blocking architectural question: a static GitHub Pages site has nowhere to hold a
  confidential client secret. Determine whether that rules an integration out or just requires
  a Supabase edge function.

No code until those two are answered.
