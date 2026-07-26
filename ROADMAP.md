# Roadmap

What's next for **Runway** (the Budgeter web app), and why. This is the forward-looking
companion to [CHANGELOG.md](CHANGELOG.md) — the changelog records what already shipped,
this file records what's worth building. When something lands, it moves out of here and
into the changelog under its release.

Entries are written the same way the changelog is: what the feature does for you, in
plain terms, rather than a ticket description. Line references point at `index.html`
(the whole app is that one file) and name the function alongside the number, so they stay
findable as the file shifts.

Live app: https://bston97.github.io/Budgeter/

---

## Next up

### Period history & actuals

**The app projects a runway every period but never checks itself.** It tells you what's
left before payday, and after 1.16.0 it projects a whole period ahead — but once that
payday arrives the projection is thrown away and a fresh one takes its place. Nothing
accumulates. The app can't tell you *"you typically land about $120 under what we
projected,"* and you can't see whether your periods are trending better or worse. Every
period starts from zero knowledge, which means the estimates never get sharper no matter
how long you use it.

The good news: **both halves of the comparison already exist.** Nothing new has to be
asked of you.

- `state.projectedAfter` — written near the end of `recompute()` (`index.html:2012`) —
  already stores what the app expected your balance to be after a given payday, keyed by
  that payday's date. It was added for the rollover nudge in 1.17.0.
- `ackRollover()` (`index.html:2049`) is the moment you confirm your *real* post-payday
  bank balance. That's the actual.

So the projected figure and the true figure meet in one place, on a date the app already
tracks. The work is recording the pair and drawing it.

**Shape.** A `periodHistory` array on state, one entry per payday, following the
`nwHistory` precedent exactly (`recordNetWorth()`, `index.html:2246`): short keys,
appended rather than rewritten, capped in length so it can't grow without bound, and
guarded in `migrate()` with an `Array.isArray` check so states saved before the feature
existed load clean.

**Display.** A block on the Runway tab listing the last several periods — projected,
actual, and the difference — plus a sparkline of the delta over time, reusing the inline
SVG approach in `renderNetWorthTrend()` (`index.html:2262`) rather than adding a charting
dependency. It stays hidden until there are at least two periods to compare, the same way
`nwTrend` hides itself below two points; one lonely row isn't a trend and shouldn't look
like one.

**Edge cases worth getting right:**

- A payday acknowledged with no stored projection (you set the app up mid-period, or the
  projection was for a different date). Record the actual, show no delta — don't invent a
  comparison.
- Editing your checking balance after you've already acknowledged the payday. The
  recorded actual is what you confirmed at the time; a later correction shouldn't silently
  rewrite history, but it also shouldn't be stranded if you're fixing a typo.
- First run must stay retroactively silent. `migrate()` already seeds `rolloverSeen` to
  the most recent payday (`index.html:1149`) so a brand-new setup is never questioned
  about a payday it wasn't around for — period history has to respect the same rule and
  not backfill entries it never observed.

---

## Later

Worth doing, not yet designed.

**Variable / discretionary spending.** Bills, debt payments, and one-off entries are all
modeled, but there's no place for groceries, gas, or eating out. That means "available"
is really "cash before you spend anything on living," which is optimistic in a way that
matters. The default bill list currently smuggles Groceries in as a fixed monthly bill
(`index.html:1083`) — that's a workaround standing in for a real model, not the answer.

**More than one income source.** `state.pay` describes a single earner on a single
schedule. No side income, no second job, no partner's paycheck landing on a different
day. Anyone with two income streams currently can't represent them.

**Savings goals / sinking funds.** The Net worth tab tracks what you have but not what
you're aiming at. "$3,000 for the car repair by March" is a different question from
"what's my savings balance," and the app can't answer it.

**Export / backup.** Everything lives in a single Supabase row with no way out — no CSV,
no JSON download. Worth having before there's years of history worth losing.

**Bill reminders.** Runway is an installed PWA and already knows every due date. It has
everything it needs to tell you a bill is due tomorrow, and currently tells you nothing
unless you open it.

---

## Not planned

Deliberately out of scope, recorded here so they stop coming back up.

**Bank / Plaid integration.** Manual entry is the point. Runway is a projection tool that
asks what you expect to happen, not an aggregator that reports what already did. Automatic
balance syncing would make it a worse version of something that already exists.

**Multi-user beyond the shared settle-up ledger.** The two-account shared ledger from
1.7.0 covers the actual need. General sharing, households, or permissions would be a
different app.

**A build step or framework.** One HTML file, no dependencies, no toolchain — you can open
it, read it, and deploy it by pushing. That constraint has kept the app fast and
debuggable, and it's a feature rather than a limitation to grow out of.
