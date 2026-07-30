# Architecture

Where Penny Pincher's code stands, where it should go, and why. This is the counterpart to
[ROADMAP.md](ROADMAP.md) — the roadmap says *what* to build, this says *what to build it
on*. Written from a full review of the app at `5e7af41` (1.18.0) against the roadmap's full
scope, and revised through 1.18.1.

Code is referenced by function name, never by line number. The app is one file that moves
by dozens of lines per commit — the 1.18.1 fix alone shifted most of this document's
original references by 73–86 lines — so a searchable name is the only reference that stays
true.

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
~3,140-line file in 8–12 scattered places, with no way to verify correctness except
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
(1.17.1). All of it lives in pure functions: `nextPayday()`,
`occurrenceInMonth()`, `mostRecentOccurrence()`,
`projectedCheck()`. Every one shipped broken because nothing is importable, so
nothing could be pinned against February or a month end before you hit it.

**Input clamping** — take-home of 1000% multiplying a paycheck tenfold (1.8.1), "05"
becoming the 15th while typing (1.8.2). These recur because the clamp-on-blur pattern is
**copy-pasted, not shared**. It exists four times: once each in the bill, card, and loan
due-day handlers — `var n = parseInt(due.value, 10)` appears verbatim in all three — plus a
separate `PAY_BOUNDS` approach for the pay inputs. The 1.14.1 fix landed in **one of the
three** due-day clones. Adding subscriptions invites a fifth copy.

### Duplication that has already drifted

- ~~**Dead code.** `renderAccounts()` describes itself as the generic row renderer
  for cards and loans. Neither uses it anymore; its only caller is its own delete handler.
  Nothing removed it, because in a file this size nothing notices.~~
  Removed in 1.27.0, along with its `.col-head.accts` rule and two now-unused core imports.
  It stayed dead for six releases, which is the point the entry was making.
- **Two parallel sync stacks.** Private (`scheduleCloud`/`pushCloud`/`onSaveFail`) and
  shared (`scheduleSharedSave`/`pushShared`, plus rev-id echo suppression). The drift has
  bitten twice in opposite directions: 1.7.0 fixed "'will retry' never actually retried on
  the shared path," a retry that existed on one stack and not its twin, and 1.18.1 had to
  port the rev ids and sequence guard back the other way. Two stacks, one behavior — every
  fix has to be applied twice, and historically hasn't been.
- ~~**`todayISO()` and `dateToISO()`** are two implementations of the same formatting.~~
  Fixed in Step 1: `todayISO()` now delegates to `dateToISO()` in `js/core.js`.
- The semi-monthly assumption is baked into **prose**, not just code: the static
  "Paid the 15th and last day of the month." above the paycheck block, "paydays are the
  15th and last day of each month" in the footer, and two more strings inside
  `renderPaycheck()`. Pay-schedule work has edit sites that can't be found by tracing
  function calls — only by searching the copy.

### `recompute()` does five jobs in a load-bearing order

`recompute()` mutates state (four expiry passes), builds the projection, writes
`state.projectedAfter` behind a pending-rollover guard, persists, then paints six regions.
The 1.17.1 bug *was* that ordering being wrong, and the invariant protecting it exists
only as a comment inside the function. Period history — the next roadmap item — has to
thread a new read and write through the same minefield.

### The data-loss race on the private path — fixed in 1.18.1, partly

This review originally found it open: the shared path gained client rev ids in 1.15.2 and
the private path never did, so `pushCloud()` upserted the whole blob unconditionally and
whichever device saved last erased the other's work entirely.

**1.18.1 fixed the clobber.** Every write now reads the server copy first and, if it moved
since the last sync, merges the two per top-level section against the last-synced copy
(`mergeRemote()`): sections only this device touched are kept, sections only the other
touched are taken, and when both changed the same one the server wins. Comparison uses a
key-sorted stringify (`canon()`) because jsonb reorders keys on the way out — the 1.15.2
lesson. The sequence guard and rev ids were ported over at the same time.

**What it did not fix, and is worth knowing:**

- **The merge is per top-level section, not per field.** Two devices editing *different
  bills* still resolves to one device's whole `bills` array. Finer granularity would mean
  either per-item ids with their own merge, or splitting the blob — neither is warranted
  yet, but the limit is real.
- **`pullCloud()` still replaces state wholesale.** On the tab-return path it's guarded by
  `!pendingSave`, but at sign-in it is unconditional, so a local edit that never reached
  the server is discarded on next load. The merge machinery now exists to fix this; it just
  isn't wired in there.
- **Saving costs an extra round trip.** The pre-write check is a second request, which also
  makes the `pagehide` flush less likely to complete than a single upsert was. A
  conditional update filtered on `data->>_rev` would collapse it back to one request in the
  happy path — deliberately not done yet, because that PostgREST filter is unproven here
  and a silent failure in the save path is worse than a round trip.
- **The private row has no realtime subscription**, unlike `shared_settle`. A second device
  learns of changes only when it saves or when its tab regains visibility.

### Agent-specific hazards

- **Edit ambiguity.** `var n = parseInt(due.value, 10);` appears verbatim in three
  handlers. The `$`-prefixed amount-input builder is written out seven times. Exact-match
  string edits genuinely risk landing on the wrong clone, and the context needed to
  disambiguate is itself duplicated.
- **Context cost.** ~3,140 lines ≈ 30–35k tokens, and `recompute()` can't be safely edited
  without also reading the renderers it orders and the mutators it triggers — effectively
  the whole script. Every task starts with a full-file read.

---

## The cost, measured: Subscriptions

The roadmap's Subscriptions item, traced end to end.

**Today — 11 edit sites spanning nearly the whole file, from the CSS block to the reset
dialog near the end:** CSS grid rules; a new HTML
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

### Step 1 — Extract the pure core, add tests · **DONE (1.20.0)**

Shipped as `js/core.js` + `tests/core.test.mjs`, 50 cases, run with `node --test`. Three
things differed from the plan below and are worth recording:

- **`mergeSections` moved into core too.** It wasn't in the original list, but it's the
  code that produced two bugs in 1.19.1, and testing it by copy was exactly the drift
  hazard this step exists to remove. `mergeRemote` in `index.html` is now just the side
  effects — adopt the result, cache it, redraw.
- **`node --test tests/` does not work** on Node 24 / Windows; it tries to resolve the
  directory as a module. Bare `node --test` auto-discovers `**/*.test.mjs` and is what the
  gate should use.
- **ES modules can't load over `file://`.** Local testing now needs a static server, which
  is a few lines of `node:http` with no dependencies. This also makes local testing more
  faithful to production than opening the file directly ever was.

The original plan follows, for the record.

### Step 1 (as planned) — Extract the pure core, add tests · ~1 day

Create `js/core.js` and move the pure functions verbatim: `num`, `money`, `stripTime`, the
merged ISO helpers, `nextPayday`, `mostRecentPayday`, `currentPeriod`,
`occurrenceInPeriod`, `occurrenceInMonth`, `occurrenceAfter`, `mostRecentOccurrence`,
`billDate`, `billOccurrence`, `cardDueDate`, `payPeriodStart`, `countWeekdays`,
`projectedCheck`. Switch the inline script to `type="module"` with one import.

**One real code change:** `projectedCheck()` closes over global `state`. It becomes
`projectedCheck(pay, payday)`, with `state.pay` passed at its three call sites — one in
`recompute()`, two in `renderPaycheck()`.

Add `tests/core.test.mjs`. Update `sw.js` SHELL and bump `CACHE` — forgetting this breaks
offline.

*Buys:* verifiability for the entire worst bug class, before any feature is built. Makes
the pay-schedule rewrite — the largest roadmap item, sitting on exactly these functions —
test-drivable. *Risks:* module scripts are deferred; confirm `boot()` still runs after DOM
parse. Small and checkable.

### Step 2 — Split the file, write down the invariants

Three commits: CSS to `styles.css`; then `js/state.js` (defaults/migrate/localStorage) and
`js/sync.js`; then `js/ui/` per section (`bills`, `cards`, `loans`, `assets`, `oneoffs`,
`settle`, `paycheck`, `rollover`) plus `js/app.js`. (Dead `renderAccounts()` is already
gone as of 1.27.0.) **No behavior changes in these commits** — that discipline is what makes a wide
mechanical change safe. Add `CLAUDE.md` with the invariants listed at the bottom of this
document and a file map, which is what preserves top-to-bottom readability.

### Step 3 — Tame `recompute()`

Extract a pure `computePeriodModel(state, today)` returning `upcoming`, `available`,
`billsBefore`, and the projections. `recompute()` becomes: expiry passes → pure model →
persist → paint. `projectedAfter` moves behind an explicit guarded function rather than an
inline ordering. Kills the 1.17.1 class structurally and makes period history land almost
entirely in core.

### Step 4 — Unify the sync layer

One channel abstraction — debounce, retry, flush-on-hide, rev-id echo suppression, conflict
merge — instantiated twice instead of written twice. 1.18.1 brought the two paths closer in
*behavior* but further apart in *code*, since the merge logic now exists only on the private
side. Folding them together is the prerequisite for dynamic pairing, which would otherwise
hand-clone a third copy. Fold in the leftovers from 1.18.1 here too: wire the merge into
`pullCloud()` so a sign-in can't discard an unsaved edit, and revisit the extra round trip.

### Step 5 — Pairing backend, when that feature is scheduled

See below. Not speculatively.

---

## Testing

**Tooling: Node's built-in runner. Nothing else.**

```
node --test
```

No `package.json`, no npm install, no jest/vitest, no build step. `tests/core.test.mjs`
uses `node:test` and `node:assert/strict` and imports `js/core.js` directly — ES modules
are the interchange format that runs untranspiled in both the browser and Node, which is
exactly why Step 1 uses them.

> **Node lives at `%LOCALAPPDATA%\Programs\nodejs`** (v24 LTS, unpacked from the official
> zip and added to the user PATH). The MSI installer via `winget` hangs on an elevation
> prompt that a non-interactive shell can't answer — the zip needs no admin and works.
>
> **Browser-level checks** still use headless Edge, and now need the app served over http,
> because ES modules are blocked over `file://`:
>
> ```
> node serve.mjs 8321                    # a few lines of node:http, no dependencies
> msedge --headless=new --disable-gpu --virtual-time-budget=12000 --dump-dom http://127.0.0.1:8321/
> ```
>
> `serve.mjs` is **not in the repo** — it lives in the scratchpad, so this is a recipe to
> recreate, not a command to run. See the same caveat in ROADMAP.md.
>
> That doubles as a smoke test: if JS-computed values are present in the dumped DOM
> (`#billsTotal` reads `$2,165.00` from the default bills), the script parsed and `boot()`
> ran. Catches a syntax or module-resolution error before a deploy does. Note `--dump-dom`
> writes to stdout, which PowerShell drops unless redirected via
> `Start-Process -RedirectStandardOutput`.

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

### The private blob: keep it

One JSONB row per user is **still right** for everything private on the roadmap — period
history, subscriptions, variable spending, multiple accounts, settings. The state is tens
of KB, whole-blob writes on a 900 ms debounce are fine, and per-user RLS on one row is the
easiest policy in Postgres to get right. Normalizing would buy nothing and cost a SQL
migration per feature — at this release cadence, migration ceremony would be the
bottleneck. `migrate()` + JSONB means a schema change is one function edit.

The one thing it genuinely needed was concurrency control, not a different storage model —
and 1.18.1 supplied it. The blob's real cost is what that fix exposed: merge granularity
can never be finer than a top-level section while the unit of storage is one record. That's
an acceptable trade at this scale, and it's the thing to re-examine if it ever isn't.

### Dynamic pairing: the hardcoded row has to die

`SHARED_ID = "household"` with a hand-configured allowlist can't generalize. The
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

Client changes are mechanical: `loadSharedSettle()`, `pushShared()`,
and the realtime filter key off the ledger id instead of the constant. Realtime
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

**Don't build a mini-framework.** Dead `renderAccounts()` is the cautionary tale
already in this codebase: the "generic" abstraction was abandoned the moment sections
diverged. Slightly repetitive imperative code per section module is safer to edit than one
clever shared abstraction whose every change fans out everywhere. Deduplicate the *clamp
logic* — a ten-line helper — not the renderers.

**Don't modernize ES5 syntax for its own sake.** Churn, no behavioral gain, real
regression risk while there are no tests. Write new code in whatever style is clearest and
leave working code alone. (The ES5 purity is already soft — `dateToISO()` uses `padStart`,
which is ES2017.)

---

## Invariants

These rules currently exist only as scattered comments, or not at all. They are the things
a mechanically-correct edit can silently break. When `CLAUDE.md` is written in Step 2,
these go in it.

1. **Never trigger a full section re-render from inside an input or click handler.** It
   swallows the next click and steals focus mid-typing. Update the one affected cell in
   place. Four separate comments in the code record this the hard way — search for
   "swallow", "eat the next click", and "steal focus".
2. **A bill's paid flag and the checking balance move together.** Ticking debits checking;
   unticking reverses it exactly. `setBillPaid()` and `adjustChecking()`
 are a pair, and nothing enforces it.
3. **Never overwrite `state.projectedAfter` while a rollover is pending acknowledgment.**
   That was the 1.17.1 bug; the guard lives in `recompute()`, keyed off `pendingRollover()`.
4. **Every new state field needs a `migrate()` guard.** `migrate()` is the
   schema. A field without a guard breaks every previously-saved state.
5. **Every new file goes in `sw.js`'s SHELL list, with a `CACHE` version bump.** Otherwise
   offline silently serves a stale shell.
6. **Amounts are stored as strings and read through `num()`.** A convention, never a
   contract — don't assume a number.
7. **Run `node --test` before pushing** (once Step 1 lands).
