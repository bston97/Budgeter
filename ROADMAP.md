# Roadmap

What's next for **Penny Pincher** (the Budgeter web app), and why. This is the forward-looking
companion to [CHANGELOG.md](CHANGELOG.md) — the changelog records what already shipped,
this file records what's worth building. When something lands, it moves out of here and
into the changelog under its release.

For *what to build it on* — the structural work these items sit on top of, and the staged
plan for getting there — see [ARCHITECTURE.md](ARCHITECTURE.md).

Entries are written the same way the changelog is: what the feature does for you, in
plain terms, rather than a ticket description. Code is referenced by function name rather
than line number — the whole app is one file that shifts by dozens of lines per commit, so
a name you can search for stays true and a number doesn't.

Live app: https://bston97.github.io/Budgeter/

**Who this is for.** Penny Pincher is a real multi-user app, not a personal tool. Anyone can sign
up, and each account already gets its own private data. That means items below which look
like polish — first-run setup, pay schedules other than semi-monthly, more than one
checking account — are actually the difference between the app working for someone else
and not. They're prioritized accordingly.

---

## Next up

### Let history sharpen the projection

Period history shipped in 1.21.0: the app now records what it projected for each payday
against what actually landed, and shows the gap. The follow-on is to *use* it. If you
consistently come in $120 under projection, the app could offer that as a suggested buffer
rather than leaving you to notice the pattern yourself — the difference between a report
and a tool that gets better the longer you use it.

`periodStats()` in `js/core.js` already returns the average, the count, and how many
periods came in under. What's undecided is where that figure belongs on screen, and
whether it adjusts the projection automatically or stays advisory. Advisory is the safer
default: silently shading the headline number would make it harder to trust, not easier.

**Worth waiting for real data before designing it.** A rule tuned against three periods is
tuned against noise. Six to eight periods in, the shape of your own error will be obvious
and the design question answers itself.


---

## Later

Worth doing, not yet designed.

**Subscriptions.** A section of their own, for any recurring payment that doesn't fit the
categories the app already has. Bills are monthly and nothing else — a bill's `due` is a
day-of-month or `EOM`, full stop — so car insurance every six months, an annual domain
renewal, quarterly taxes, or a yearly Prime charge have nowhere to live. The workaround is
dividing by twelve and pretending it's monthly, which makes the runway wrong in both
directions: slightly too pessimistic most months, then badly too optimistic the month it
actually lands.

Each subscription should carry a name, an amount, a **start date**, and a **time frame**
(monthly, quarterly, semi-annual, annual — and whatever else earns its place), so the app
can resolve the next occurrence from the date rather than from a day-of-month alone. Once
that resolves to a date, the rest is existing machinery: `occurrenceInPeriod()`
 to decide whether it falls in this window, the timeline and available
-cash treatment bills already get, and the paid-tick behavior from `setBillPaid()`
 so an annual charge can be ticked off like anything else.

**Variable / discretionary spending.** Bills, debt payments, and one-off entries are all
modeled, but there's no place for groceries, gas, or eating out. That means "available"
is really "cash before you spend anything on living," which is optimistic in a way that
matters. The default bill list currently smuggles Groceries in as a fixed monthly bill
 — that's a workaround standing in for a real model, not the answer.

**Pay schedules other than semi-monthly.** `nextPayday()` hardcodes
the 15th and the last day of the month. Weekly and biweekly pay can't be expressed at all,
and biweekly is the most common schedule there is — anyone on it can't use the app.

This is the largest item on the board and should be treated as such. The semi-monthly
assumption isn't in one function; it's the foundation everything else sits on.
`mostRecentPayday()` and `currentPeriod()` both
enumerate the same two dates. `occurrenceInPeriod()` relies on periods
being ≤16 days to guarantee at most one occurrence per window — a monthly bill in a weekly
period breaks that assumption outright. The weekday-counting projection in
`projectedCheck()` is built around a semi-monthly period's 10–12
weekdays, and the rollover nudge keys off `mostRecentPayday()` too. Generalizing the
schedule means revisiting all of it, so it deserves a real design pass before anyone
starts.

**More than one income source.** `state.pay` describes a single earner on a single
schedule. No side income, no second job, no partner's paycheck landing on a different
day. Anyone with two income streams currently can't represent them.

**Savings goals / sinking funds.** The Net worth tab tracks what you have but not what
you're aiming at. "$3,000 for the car repair by March" is a different question from
"what's my savings balance," and the app can't answer it.

**A settings page.** Everything that configures the app is scattered across the edges of
the screen. The theme toggle, "Set password," and "Sign out" live in the header, the
password panel expands inline underneath it, and "Reset all data" is buried in the footer
next to a run-on sentence. None of it belongs in the flow of a budgeting screen, and
there's nowhere to put the next setting that comes along.

A proper settings view would collect what already exists — theme, password, sign out,
clear data — and give a home to things that currently can't exist at all: **which tabs to
show** (not everyone needs Settle up), the participant names that are currently editable
only from inside the Settle-up tab, and whatever the items above turn out to need. Worth
noting the tab strip hardcodes "you & Maria" as the Settle-up subtitle
 even though those names have been user-editable since 1.7.0 — a
settings page is the natural place to fix that properly.

**First-run setup.** A brand-new account opens onto someone else's budget: Rent $1,200,
Car payment $340, Electric $95, Phone $70, Internet $60, Groceries $400, plus a "Visa,"
a "Car loan," and Robinhood/401(k)/Savings — all from `defaults()`.
Every one has to be found and deleted before the app tells you the truth, and until then
the headline number on the Payday tab is fiction. Placeholder rows are a reasonable way
to show the shape of the thing, but they shouldn't be indistinguishable from real data.

**More than one checking account.** `state.checking` is a single string, so the entire
runway calculation runs off one number. A joint account plus a personal one, or checking
plus a spending account you actually pay from, can't be represented — you have to add
them in your head and enter the total, which then can't be reconciled against either bank.

**Undo on delete.** Every `×` button deletes immediately and permanently —
`state.bills.splice(i, 1)`, and the same one-liner for cards, loans, assets, and one-off
entries. There's no confirmation and nothing to undo it with; confirmations exist only for
settling up, clearing settle-up history, and the full data reset. On a phone that `×` is a
small target sitting right beside an amount field, and deleting a card takes its due date,
payment amount, and paid state with it. A brief undo — a few seconds to take it back —
would fit the app's style better than a confirm dialog on every row.

**Export / backup.** Everything lives in a single Supabase row with no way out — no CSV,
no JSON download. Worth having before there's years of history worth losing.

**Bill reminders.** Penny Pincher is an installed PWA and already knows every due date. It has
everything it needs to tell you a bill is due tomorrow, and currently tells you nothing
unless you open it.

**Shared ledgers for any two people.** The Settle-up tab is shared between exactly two
accounts today, and it works — but it only works *once*. `SHARED_ID` is the hardcoded
string `"household"`, so there is a single shared ledger row in the
entire app, kept private to the two accounts on a Supabase allowlist set up by hand. A
third person who signs up can never pair with anyone. Any two other users wanting what you
and Maria have would need someone to edit the database for them.

Generalizing it means three pieces:

- **Identity.** A shared ledger keyed to the pair that owns it rather than to a constant,
  so many can exist side by side. Everything downstream — `loadSharedSettle()`,
  `pushShared()`, and the realtime subscription filter in `subscribeShared()` — currently
  filters on `SHARED_ID` and would key off the pair instead.
- **Mutual confirmation.** One person invites, the other accepts, and nothing is shared
  until both have said yes. Until then the tab shows the pending state plainly — visible
  but not editable, blurred, with text explaining it can't be used until both sides
  confirm. Consent from both people before a single shared record exists is the whole
  point; being added to someone's shared ledger without agreeing shouldn't be possible.
- **Enforcement in the database, not the page.** Privacy here can't be a UI decision.
  Today's allowlist is enforced by Supabase row-level security, and that has to stay true
  when pairs are dynamic: policies driven by the two member ids stored on the row, so a
  pair's ledger is unreadable to everyone else no matter what any client asks for.

Way down the line, and worth designing carefully rather than quickly — this is the one
feature where a mistake exposes one user's data to another.

**Tests for the parts that aren't pure.** The pure core got covered in 1.20.0 and has grown
with each release since — 80 cases in `tests/core.test.mjs` as of 1.26.0, run with
`node --test tests/core.test.mjs`, each named for the release whose bug it pins. That was
the highest-risk code and it's done.

What's still untested is everything that touches the DOM or the network: the renderers,
the event wiring, and the sync layer's side effects (as opposed to `mergeSections`, which
is now pure and covered). Those are currently checked by driving headless Edge against a
local server and asserting on the dumped DOM, which works but lives in the scratchpad
rather than the repo, so it isn't a gate anyone else could run.

Making that durable is worth doing eventually, but it's a much smaller win than Step 1
was: the bug record is overwhelmingly date maths and clamping, not rendering. Worth
revisiting if render bugs start showing up in the changelog.


---

## Not planned

Deliberately out of scope, recorded here so they stop coming back up.

**Bank / Plaid integration.** Manual entry is the point. Penny Pincher is a projection tool that
asks what you expect to happen, not an aggregator that reports what already did. Automatic
balance syncing would make it a worse version of something that already exists.

**A framework adopted for its own sake.** What's worth protecting here isn't the single
file — it's what the single file currently buys: the app loads fast, you can read the
whole thing top to bottom, there's no dependency tree to maintain, and deploying is a
push. Rewriting onto React or a bundler because that's what apps use would trade all of
that for nothing.

This is deliberately written as a set of qualities rather than as "never add tooling,"
because whether the current structure is still the best way to get them is an open
question — not a settled one. The test safety net above is already a case in point: the
logic lives inside an IIFE in a `<script>` tag, so nothing can be imported and nothing can
be tested, and that's a real cost being paid for the current shape. Any proposal that
preserves the qualities above is fair game, including ones that introduce a build step.
