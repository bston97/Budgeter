# Architecture

Where Runway's code stands, where it should go, and why. This is the counterpart to
[ROADMAP.md](ROADMAP.md) — the roadmap says *what* to build, this says *what to build it
on*. Written from a full review of the app as of `5e7af41` (1.18.0), against the roadmap's
full scope.

The optimization target is unusual and worth stating plainly, because it drives every
recommendation below: **this codebase's primary maintainer is an AI agent.** That is not
the same as optimizing for a human team. It means context cost, locality, and — above all
— whether a change can be *proven correct before the user sees it* matter more than the
conventions a team would normally reach for.

---

## Verdict

**Evolve incrementally. Keep the stack, break up the file.**

| Keep | Change |
|---|---|
| Vanilla JS, imperative DOM | The single 3,000-line file |
| Supabase (auth + JSONB blob) | The untestable pure core |
| GitHub Pages, deploy-by-push | The hardcoded shared-ledger row |
| PWA / service worker | Four copies of the input-clamp pattern |
| No framework, no bundler, no dependency tree | Two independently-drifting sync stacks |

The foundation is sound. What fails is that every roadmap item requires editing one
3,058-line file in 8–12 scattered places, with no way to verify correctness except
shipping to the user. The fix is **native ES modules** — `<script type="module">` works
untranspiled in browsers and on GitHub Pages, so modularity costs no build step, no
dependencies, and no change to how deploys work. Every quality worth protecting survives.

---

## What's wrong today

### The bug record is an architectural symptom

18 releases in two days produced at least seven shipped-then-fixed bugs, and they cluster
almost perfectly into two classes:

**Date math** — days 29–31 not existing in every month (1.8.2), a loan due-day edit
charging a payment mid-type (1.14.1), a projection clobbered before its reader ran
(1.17.1). All of it lives in pure functions: `nextPayday()` (`index.html:1221`),
`occurrenceInMonth()` (`:1293`), `mostRecentOccurrence()` (`:1302`),
`projectedCheck()` (`:1416`). Every one shipped broken because nothing is importable, so
nothing could be pinned against February or a month end before you hit it.

**Input clamping** — take-home of 1000% multiplying a paycheck tenfold (1.8.1), "05"
becoming the 15th while typing (1.8.2). These recur because the clamp-on-blur pattern is
**copy-pasted, not shared**. It exists four times: bills (`:1853`), cards (`:1520`), loans
(`:1580`), and a separate `PAY_BOUNDS` approach for pay inputs (`:2730`). The 1.14.1 fix
landed in **one of the three** due-day clones. Adding subscriptions invites a fifth copy.

### Duplication that has already drifted

- **Dead code.** `renderAccounts()` (`:1475`) describes itself as the generic row renderer
  for cards and loans. Neither uses it anymore; its only caller is its own delete handler.
  Nothing removed it, because in a file this size nothing notices.
- **Two parallel sync stacks.** Private (`scheduleCloud`/`pushCloud`/`onSaveFail`,
  `:1176`) and shared (`scheduleSharedSave`/`pushShared` + rev-id echo suppression,
  `:2357`). The drift already bit once — 1.7.0 fixed "'will retry' never actually retried
  on the shared path," a retry that existed on one stack and not its twin. It has since
  drifted the other way; see the open race below.
- **`todayISO()` (`:2327`) and `dateToISO()` (`:1396`)** are two implementations of the
  same formatting.
- The semi-monthly assumption is baked into **prose**, not just code: static copy at
  `:677`, the footer at `:1042`, and two strings in `renderPaycheck()` (`:2091`). Pay-schedule
  work has edit sites that can't be found by tracing function calls.

### `recompute()` does five jobs in a load-bearing order

`recompute()` (`:1944`) mutates state (four expiry passes), builds the projection, writes
`state.projectedAfter` behind a pending-rollover guard, persists, then paints six regions.
The 1.17.1 bug *was* that ordering being wrong, and the invariant protecting it exists
only as a comment inside the function. Period history — the next roadmap item — has to
thread a new read and write through the same minefield.

### An open data-loss race on the private path

The shared path gained client rev ids in 1.15.2. **The private path never did.**
`pushCloud()` (`:1183`) upserts unconditionally and `pullCloud()` (`:3002`) replaces state
wholesale, guarded only by a `pendingSave` flag. Two devices open at once — a scenario the
changelog actively advertises — can silently destroy each other's edits, and because the
unit of storage is one JSON blob, the loss is total rather than per-field. This is the
same race already fixed once, still open on the other side. It is a live bug, not a
roadmap item.

### Agent-specific hazards

- **Edit ambiguity.** `var n = parseInt(due.value, 10);` appears verbatim in three
  handlers. The `$`-prefixed amount-input builder is written out seven times. Exact-match
  string edits genuinely risk landing on the wrong clone, and the context needed to
  disambiguate is itself duplicated.
- **Context cost.** ~3,060 lines ≈ 30–35k tokens, and `recompute()` can't be safely edited
  without also reading the renderers it orders and the mutators it triggers — effectively
  the whole script. Every task starts with a full-file read.

---

## The cost, measured: Subscriptions

The roadmap's Subscriptions item, traced end to end.

**Today — 11 edit sites spanning lines ~350 to ~2780:** CSS grid rules; a new HTML
section; `defaults()`; `migrate()`; a new recurrence function (start-date + interval —
`occurrenceInPeriod()` only handles day-of-month and assumes monthly cadence); a
`renderSubscriptions()` cloned from `renderBills()` (inheriting clamp copy #5); the
paid-tick lifecycle across `setBillPaid()`/`applyPassedBills()` and its `adjustChecking()`
coupling; `recompute()`'s `upcoming` array plus the next-period and two-period math;
`renderAll()`; `wireStatic()`; and reset-dialog copy. Verification: **none possible** —
the new recurrence math ships unproven, in the app's single worst bug class.

**After restructuring — ~5 files, ~700 lines of context:** a pure
`subscriptionOccurrence()` in `js/core.js` *with tests that run in under a second*; a
migrate guard in `js/state.js`; one `js/ui/subscriptions.js`; two lines of registration;
CSS and the service-worker shell list.

The decisive difference isn't file count. It's that the risky part becomes provable before
you ever see it.

---

## Staged plan

Each step ships independently and leaves the app working.

### Step 1 — Extract the pure core, add tests · **highest value, ~1 day**

Create `js/core.js` and move the pure functions verbatim: `num`, `money`, `stripTime`, the
merged ISO helpers, `nextPayday`, `mostRecentPayday`, `currentPeriod`,
`occurrenceInPeriod`, `occurrenceInMonth`, `occurrenceAfter`, `mostRecentOccurrence`,
`billDate`, `billOccurrence`, `cardDueDate`, `payPeriodStart`, `countWeekdays`,
`projectedCheck`. Switch the inline script to `type="module"` with one import.

**One real code change:** `projectedCheck()` closes over global `state`. It becomes
`projectedCheck(pay, payday)`, with `state.pay` passed at its call sites (`:2014`,
`:2086`, `:2159`).

Add `tests/core.test.mjs`. Update `sw.js` SHELL and bump `CACHE` — forgetting this breaks
offline.

*Buys:* verifiability for the entire worst bug class, before any feature is built. Makes
the pay-schedule rewrite — the largest roadmap item, sitting on exactly these functions —
test-drivable. *Risks:* module scripts are deferred; confirm `boot()` still runs after DOM
parse. Small and checkable.

### Step 2 — Split the file, write down the invariants

Three commits: CSS to `styles.css`; then `js/state.js` (defaults/migrate/localStorage) and
`js/sync.js`; then `js/ui/` per section (`bills`, `cards`, `loans`, `assets`, `oneoffs`,
`settle`, `paycheck`, `rollover`) plus `js/app.js`. Delete dead `renderAccounts()` while
moving. **No behavior changes in these commits** — that discipline is what makes a wide
mechanical change safe. Add `CLAUDE.md` with the invariants listed at the bottom of this
document and a file map, which is what preserves top-to-bottom readability.

### Step 3 — Tame `recompute()`

Extract a pure `computePeriodModel(state, today)` returning `upcoming`, `available`,
`billsBefore`, and the projections. `recompute()` becomes: expiry passes → pure model →
persist → paint. `projectedAfter` moves behind an explicit guarded function rather than an
inline ordering. Kills the 1.17.1 class structurally and makes period history land almost
entirely in core.

### Step 4 — Unify the sync layer

One channel abstraction — debounce, retry, flush-on-hide, rev-id echo suppression —
instantiated twice, and **give the private path the rev ids it lacks**. Prerequisite for
dynamic pairing, which would otherwise hand-clone a third copy.

### Step 5 — Pairing backend, when that feature is scheduled

See below. Not speculatively.

---

## Testing

**Tooling: Node's built-in runner. Nothing else.**

```
node --test tests/
```

No `package.json`, no npm install, no jest/vitest, no build step. `tests/core.test.mjs`
uses `node:test` and `node:assert/strict` and imports `js/core.js` directly — ES modules
are the interchange format that runs untranspiled in both the browser and Node, which is
exactly why Step 1 uses them.

> **Prerequisite: Node isn't currently installed on the dev machine** (nor Deno or Bun;
> the `python` on PATH is a Microsoft Store stub). Step 1 needs it installed first.
>
> Until then, headless Edge is a working stand-in and needs nothing installed — it runs
> the real JS engine against a test page:
>
> ```
> msedge --headless=new --disable-gpu --virtual-time-budget=5000 --dump-dom file:///…/test.html
> ```
>
> It also doubles as a smoke test: loading `index.html` this way and checking that
> JS-computed values are present in the dumped DOM (`#billsTotal` reads `$2,165.00` from
> the default bills) proves the script parsed and `boot()` ran. That catches a syntax
> error before a deploy does. Note `--dump-dom` writes to stdout, which PowerShell drops
> unless you redirect it via `Start-Process -RedirectStandardOutput`.

**The first test file writes itself from the changelog.** Each shipped bug becomes a
pinned regression case:

- `nextPayday(Jul 15)` → Jul 31; `nextPayday(Jul 31)` → Aug 15; `nextPayday(Feb 28)` → Mar 15
- `occurrenceInMonth("EOM", 2026, 1)` → Feb 28; `occurrenceInMonth(31, 2026, 3)` → Apr 30 *(1.8.2)*
- `occurrenceInPeriod` with a due day on each period boundary
- `countWeekdays` across all four period shapes (10–12 weekdays)
- `projectedCheck` with takeHome > 100, daysOff > weekdays, blank hours *(1.8.1)*
- `mostRecentOccurrence(15, …)` vs `(1, …)` — the half-typed-day scenario *(1.14.1)*
- `money(-0.004)` → `$0.00` *(1.3.0)*

**Gate:** run `node --test` before any push. A ten-line GitHub Action can mirror it as a
backstop, but it adds nothing an agent can't do locally in under a second.

---

## Backend

### The private blob: keep it, with one fix

One JSONB row per user is **still right** for everything private on the roadmap — period
history, subscriptions, variable spending, multiple accounts, settings. The state is tens
of KB, whole-blob writes on a 900 ms debounce are fine, and per-user RLS on one row is the
easiest policy in Postgres to get right. Normalizing would buy nothing and cost a SQL
migration per feature — at this release cadence, migration ceremony would be the
bottleneck. `migrate()` + JSONB means a schema change is one function edit.

The fix it needs is the rev-id race described above, not a different storage model.

### Dynamic pairing: the hardcoded row has to die

`SHARED_ID = "household"` (`:2341`) with a hand-configured allowlist can't generalize. The
anon key and all client code are public, so **the trust boundary must be the database.**

```sql
create table ledgers (
  id            uuid primary key default gen_random_uuid(),
  member_a      uuid not null references auth.users(id),
  member_b      uuid references auth.users(id),      -- null until accepted
  invited_email text not null,                       -- lowercase at insert
  status        text not null default 'pending'
                  check (status in ('pending','active')),
  data          jsonb not null default '{}',
  updated_at    timestamptz not null default now(),
  check (member_a <> member_b)
);
alter table ledgers enable row level security;

-- read: members always; the invitee may see the pending row, to render the invite
create policy ledger_select on ledgers for select using (
  auth.uid() in (member_a, member_b)
  or (status = 'pending' and lower(auth.jwt()->>'email') = invited_email)
);

-- create an invite: you can only make yourself member_a
create policy ledger_insert on ledgers for insert
  with check (auth.uid() = member_a and member_b is null and status = 'pending');

-- edit data: active members only
create policy ledger_update on ledgers for update
  using (status = 'active' and auth.uid() in (member_a, member_b));
```

**Acceptance must be a `security definer` RPC, never a client update.**
`accept_ledger_invite(ledger_id)` sets `member_b = auth.uid()` and `status = 'active'` only
if `member_b is null` and the caller's email matches `invited_email`. That makes "nothing
is shared until both said yes" a database fact rather than a UI decision.

Client changes are mechanical: `loadSharedSettle()` (`:2391`), `pushShared()` (`:2374`),
and the realtime filter (`:2509`) key off the ledger id instead of the constant. Realtime
`postgres_changes` respects RLS, so subscription eavesdropping is closed too. Verify the
policies the only way that counts: a second real account attempting every operation it
shouldn't be able to perform.

The ledger's *contents* stay a JSONB blob. Pairing needs relational identity, not
relational data.

---

## What not to do

**No framework, bundler, or transpiler.** These would trade a working imperative model for
a dependency tree, a build pipeline, and rewrite risk. For an AI maintainer a framework's
main value — shielding humans from DOM bookkeeping — is worth less, while its costs
(version churn, opaque build failures) are new. Native ES modules give the modularity
without any of it.

**No TypeScript compile step.** JSDoc annotations cost nothing at runtime if typing is
ever wanted. A build step that can fail is a new way for deploy-by-push to break.

**Don't normalize private data into tables.** See above.

**Don't reach for Playwright first.** Slow, flaky, needs a browser runtime, and it verifies
the least bug-prone layer while the actual bug record is entirely date math and clamping.

**Don't over-shard.** Fifty 30-line files are as hostile to an agent as one 3,000-line
file — context fragments and cross-file hops replace scrolling. Target 8–12 modules of
100–400 lines, one per domain concern.

**Don't build a mini-framework.** Dead `renderAccounts()` (`:1475`) is the cautionary tale
already in this codebase: the "generic" abstraction was abandoned the moment sections
diverged. Slightly repetitive imperative code per section module is safer to edit than one
clever shared abstraction whose every change fans out everywhere. Deduplicate the *clamp
logic* — a ten-line helper — not the renderers.

**Don't modernize ES5 syntax for its own sake.** Churn, no behavioral gain, real
regression risk while there are no tests. Write new code in whatever style is clearest and
leave working code alone. (The ES5 purity is already soft — `padStart` at `:1397` is
ES2017.)

---

## Invariants

These rules currently exist only as scattered comments, or not at all. They are the things
a mechanically-correct edit can silently break. When `CLAUDE.md` is written in Step 2,
these go in it.

1. **Never trigger a full section re-render from inside an input or click handler.** It
   swallows the next click and steals focus mid-typing. Update the one affected cell in
   place. Four separate comments in the code record this the hard way (`:1683`, `:1753`,
   `:1910`, `:2555`).
2. **A bill's paid flag and the checking balance move together.** Ticking debits checking;
   unticking reverses it exactly. `setBillPaid()` (`:1343`) and `adjustChecking()`
   (`:1338`) are a pair, and nothing enforces it.
3. **Never overwrite `state.projectedAfter` while a rollover is pending acknowledgment.**
   That was the 1.17.1 bug; the guard lives at `:2011`.
4. **Every new state field needs a `migrate()` guard.** `migrate()` (`:1094`) is the
   schema. A field without a guard breaks every previously-saved state.
5. **Every new file goes in `sw.js`'s SHELL list, with a `CACHE` version bump.** Otherwise
   offline silently serves a stale shell.
6. **Amounts are stored as strings and read through `num()`.** A convention, never a
   contract — don't assume a number.
7. **Run `node --test` before pushing** (once Step 1 lands).
