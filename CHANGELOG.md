# Changelog

Notable changes to **Penny Pincher** (the Budgeter web app, called Runway up to 1.18.1),
grouped by feature release. Smaller
patch fixes are summarized within the release they shipped under rather than listed separately.
Versions follow [Semantic Versioning](https://semver.org/): the middle number is a feature
release, the last is a small fix.

Live app: https://bston97.github.io/Budgeter/

## [1.27.0] — 2026-07-30

### Added
- **Download a backup**, in the footer. A single JSON file with everything the app holds — your budget, and the shared settle-up ledger if you're on one. Until now there was no way to get your own numbers out of here.

### Fixed
- **Rows fit on a phone again.** Bills, cards and settle-up entries kept all their columns side by side no matter how narrow the screen, squeezing the name down to a sliver — and the new Minimum column would have made cards far worse. Each of those now folds onto a second line below about 860px, the way loan and asset rows already did. A stray pixel of sideways scroll on the settle-up tab is gone with it.

- **Settle-up history is colour-coded**, green when the money came your way and red when it went out. The styling had been written but never applied.

- **Deleting a settle-up entry always removes the one you clicked**, even if your partner's edit rebuilt the list a moment earlier. Every other list was fixed this way in 1.19.0; this one was missed.

- The name and amount boxes in every row now announce themselves properly to a screen reader instead of reading as an unlabelled text field.

- **An installed app can reach the sign-in screen offline.** The sign-in library was only cached once it had been fetched at least once, so installing the app and first opening it without a connection left you stuck on "Couldn't load the sign-in service". It's now fetched at install time — separately from the rest, so a hiccup fetching it can't take the whole offline copy down with it.

### Changed
- Removed `renderAccounts()`, dead since the card and loan rows got their own renderers, plus its leftover styles and two unused imports. An installed app is no longer locked to portrait, which was fighting the two-column layout on a tablet.
- Docs corrected where they'd drifted: the test count, a fix recorded as still outstanding, and two commands that don't work as written.

## [1.26.0] — 2026-07-30

### Added
- **A minimum payment per card.** New column on the Net worth tab, next to the balance. It's the one number about a card that doesn't move month to month, so it lives with the balance rather than being retyped. On the Payday tab it shows up as the amount the box is expecting, and if you enter less than it, the row says **under the $35.00 minimum** in amber. Nothing is blocked — sometimes less is the plan — it just won't let you do it without noticing. Leave it blank and nothing changes.

- **Clear a single card payment.** A × appears on a payment row once an amount is recorded there. Before this, blanking the box put the previous payment back by design, so a wrong entry could be overwritten but never actually removed. Nothing is refunded when you clear one: a payment still charged to this period was only ever a projection, and one from an earlier period was already squared up at its payday.

- **"Clear this cycle's entries"**, in the footer. Wipes the two things you retype every cycle — what you paid each card, and the extra money in and out — and leaves everything that describes how things *are*: balances, bills, due days, minimums, and your paid ticks. Bill ticks are deliberately left alone, since unticking one has to hand the money back to checking, and that's a decision per bill rather than a sweep. It says what it will do before it does it, and tells you if there was nothing to clear.

### Fixed
- **A half-typed due day no longer moves money.** Due days are typed a character at a time, and the app was treating anything it couldn't read as the 1st — so on the way to "25", the app briefly put the bill on the 1st of the month and charged it there. Anything that isn't a real day is now simply not a date, which is what the rest of the app already assumed.

- **Typing a bill's due day doesn't jump away after the first digit.** "2" on the way to "25" is a real date that may already have passed, and the app was deciding then and there that the bill was paid, ticking it for a day you never meant and rebuilding the list under your cursor. It now waits until you've moved on.

- A card payment whose due day you later cleared no longer disappears from the projection — the money still left. One-off entries saved before per-period expiry existed now get one, instead of quietly dragging every period forever. And the bill due-day and credit-score boxes lost their number spinners, matching the card and loan boxes.

## [1.25.0] — 2026-07-30

### Fixed
- **Edits made offline are no longer thrown away.** If you changed something with no connection — or closed the tab in the second before a save landed — those edits lived only on this device. The next time the app opened, it replaced everything with the older copy from the cloud, and the changes were gone with nothing to say so. The app now writes down that it's ahead of the server, and what the server held at the time, so the next sign-in reconciles the two instead of picking one: your offline edits stay, and anything another device changed in the meantime still arrives.

- **Two accounts on one device no longer see each other's money.** The saved copy was kept under a single name shared by every account. Sign in as someone else and the previous person's budget was sitting there — and if the new account had never synced before, the app would *upload* that budget as theirs. Each account's copy is now filed under its own name. The first account to sign in after this update takes over the existing copy (nothing of yours moves), and no one after that can reach it.

- **A session that expires now clears the screen.** Only the sign-out button used to tidy up. If a session simply ran out, the previous account's numbers stayed on screen and in memory for whoever signed in next. Signing out also no longer strands your data if the network call fails on the way out.

- **A dropped connection no longer hides the shared settle-up ledger.** A failed load — coming back to the tab offline, a hiccup at the server — quietly switched you to your own private ledger, which is usually empty. Anything typed there vanished from view once the shared one came back. A failed load now changes nothing; you keep looking at the ledger you were already on.

- **Your own settle-up edits can't be reverted by an update you'd already been shown.** If your partner's change arrived while you were mid-edit, the app held it back until you finished — then applied it *after* your newer edit had already been sent, rolling your entry back and pushing the rollback. Held updates are now ordered against your own writes, so only genuinely newer changes are applied.

### Known limitation
- The shared settle-up ledger is still last-write-wins as a whole. If both people add an entry within about a second of each other, one of the two can still be lost. Fixing that properly means giving each ledger row a stable id and merging row by row — a separate change.

## [1.24.0] — 2026-07-30

### Fixed
- **Money entered on a payday no longer falls through the cracks.** The 15th and the last day of the month sit on the boundary between two periods, and two things quietly went wrong there. A card payment typed on payday itself was marked "paid" the moment you typed it — charged to no period at all, so your available cash read high by the whole payment. And a bill due on payday that you'd already ticked off was counted as owing again all day (its paid-tick was also locked with "Not due this pay period"). Both now land where you'd expect: payday-day money belongs to the period that payday opens.

- **A payment doesn't vanish from your balance the day after its due date anymore.** When a card payment's due date passed, the app dropped the amount so next cycle starts blank — but it never took the money out of checking, so "available" jumped *up* by the payment the morning after. Bills already handled this correctly; cards and loans now do too: when the record clears, checking is debited to match, because that money really did leave. A payment made back in an earlier period isn't touched — that one was already squared up at payday.

- **Loan payments now come out of checking, not just off the loan.** A loan's auto-payment used to reduce the loan balance on the due day while checking stayed put — and on the due day itself the payment was double-counted, both "upcoming" and already applied. It now applies the day after the due date, debiting checking once, same as cards.

- **A bill that lands while the app is closed over a payday is still paid.** If the app was watching a bill ("due in 2 days") and you didn't open it again until the next period, the promise to debit checking was silently dropped. It now catches up the moment you're back.

- **What's already paid shows up in the next-period preview.** Pay a card today that isn't due until next period, and the preview used to just drop the row. It now shows the row struck through with a *paid* tag, the date it went out, and $0 counted toward that period's total.

### Changed
- **The ½ button on the settle-up ledger is a toggle now.** It used to halve the amount again on every tap; a mis-tap meant retyping the bill. Tap once to split, tap again to put the full amount back — the button lights up while a split is active. Typing a new amount releases the split. If the other person edits a shared entry's amount, the toggle lets go rather than restoring a number that no longer matches.

- Hardened saving: one hiccup while redrawing synced data could previously switch off saving for the rest of the session without saying so.

## [1.23.0] — 2026-07-29

### Fixed
- **A card payment now counts against the period you typed it in.** Pay two cards on the same day and only one of them is due this cycle: the app used to park the second one on its due date next month, so the money had left your account but the app still counted it as available. You'd look flush for two weeks and come up short.

  An amount you enter is treated as money leaving that day. If the due date is still ahead of you inside the same period, nothing changes — it stays on the due date, where the running balance expects it. Otherwise it lands on the day you typed it.

  When the period holding the due date comes around, that row shows nothing owing and says what already went out — *paid $200 · Jul 29* — instead of asking for the money a second time. Type a new amount there and it becomes this period's payment; clear it again and the old one comes back.

  Payments entered before this update keep their old meaning until they clear, so nothing you already typed moves on its own.

## [1.22.0] — 2026-07-29

### Changed
- **Salaried pay is one number now: what actually hits your account.** It used to ask for an annual salary and a take-home percentage, then divide by 24 and multiply the two together to guess at a check. That was arithmetic you had to reverse-engineer to check, built on a percentage nobody knows off the top of their head. The Salaried pay type now asks for **take-home per paycheck** and uses it exactly as entered — no estimate, no percentage, nothing to work out.

  Annual salary and take-home % are gone from the salaried view (take-home % stays for Hourly, where the estimate still needs it). If you had a salary entered, it was converted for you: the app filled in the same figure it had been showing you (salary ÷ 24 × take-home %), so your projection didn't move — you can now just type over it with the real number from your pay stub.

## [1.21.0] — 2026-07-28

### Added
- **How past periods went.** The app has always projected what you'd have left, then thrown that number away once payday arrived. Now it keeps them. A new block on the Payday tab lists each payday you've confirmed a balance for — what was projected, what you actually had, and the difference — with a small chart of that gap over time and a running summary like *"typically $91.50 under"*.

  Nothing extra is asked of you. Both figures already existed: the app records its projection every time it recalculates, and the payday nudge is where you type in your real balance. It just pairs them up now.

  It only learns from a payday where you actually **confirmed a balance** — dismissing the nudge records nothing, because a guessed number is worse than no row. A payday the app never projected for still gets a row, with a dash instead of a made-up difference. The block stays hidden until there are two periods to compare, since one row isn't a trend.

## [1.20.0] — 2026-07-28

### Changed
- **The date and money logic now has tests.** Nothing about the app looks or behaves differently — this is groundwork. The calculations that decide when your bills are due, when payday falls, and what your next check comes to have moved into their own file, and there are now 50 automated checks that run against them in under a second.

  This matters because that code is where nearly every bug in this changelog came from: a due day that turned "05" into the 15th while you typed, days 29–31 in months that don't have them, a take-home percentage over 100 multiplying a paycheck tenfold, typing a loan's due day taking a payment off the balance. Every one of those shipped and was found afterwards. Each is now a permanent test, so it can't come back — and the next change to that code gets checked before it reaches you rather than after.

## [1.19.1] — 2026-07-26

### Fixed
- **Typing could go nowhere after another device saved.** When a change arrived from your other device, the app rebuilt its copy of your budget from the cloud — and the rows already on screen were still wired to the old copy. The rewiring was held back while you were typing, but moving straight from one field to the next never counted as stopping, so it never happened. Type into a section you hadn't already touched and the keystrokes went into the void: nothing saved, nothing said. Rows now stay wired when nothing about their section actually changed, and if a section genuinely did change, clicking into it rebuilds first.
- **Saves fired when there was nothing to save.** Hiding the tab, closing it, or reconnecting kicked off a full save every time, whether or not anything had changed. Each of those stamps the record as updated, so your *other* device would see a change that wasn't one and redraw itself for nothing. Both now check that something is actually pending first.

## [1.19.0] — 2026-07-26

### Changed
- **Runway is now Penny Pincher.** The old name described the number; the new one describes the person using it — which suits a duct-taped wallet a lot better. It's Penny Pincher everywhere in the app; the home-screen icon is labelled **Budgeter**, since the full name is wider than a phone gives an icon caption. The first tab, previously also called "Runway" and confusingly sharing the app's name, is now simply **Payday**.

  Nothing about your data moves. Your saved budget, your settle-up ledger with Maria, and your sign-in are all untouched.

### Added
- **Meet Penny.** The app's explanations now come from someone rather than from nowhere. Wherever there's a hint — what belongs in Assets, how debt payments work, how to carry over a running tab in Settle up — it's Penny telling you, and she has a bit of a personality about it. She turns up when a section needs explaining and stays out of the way otherwise. She also speaks up when you clear every bill in a pay period.
- **The numbers roll instead of snapping.** Your available cash and net worth count up (or down) to their new value over about four tenths of a second, so a change reads as movement rather than a figure blinking into something else. It's deliberately skipped while you're typing in a field — when you're entering your balance the number has to keep up with the keystroke, not lag behind it.
- **Ticking a bill paid feels like something.** The checkbox pops when you mark a bill paid, and the row eases into its struck-through state instead of switching instantly. Tick the **last** bill due this pay period and you get a small burst of confetti — you cleared the period, which is worth half a second of acknowledgement.
- **Rows arrive and leave.** Adding a bill, card, loan, asset, or entry slides the new row in, and deleting one lets it fade out before the list closes up, instead of everything jumping.

All of it honors your system's **reduce motion** setting: switch that on and every animation is skipped, with the app behaving identically otherwise.

### Fixed
- **Deleting a row now removes the row you clicked.** Deletes were by position in the list, which was fine when the list couldn't change underneath them — with rows now animating out, they're matched by identity instead, so the right one always goes.

## [1.18.1] — 2026-07-26

### Fixed
- **Two devices can no longer erase each other's changes.** Your whole budget is held in memory on every device you have open, and a save wrote that copy over whatever was in the cloud — so if your phone had been sitting open since yesterday, the next thing you typed on it would quietly wipe everything you'd changed on your laptop. There was no warning, and because it's stored as one record, it took everything with it, not just the field you touched.

  Saves now look at what's actually in the cloud first. If another device wrote something since this one last synced, the two are combined section by section: what you changed here is kept, what you changed there is picked up, and only when both devices edited *the same* section does one have to win (the one that saved first). Whatever field you're typing in is always treated as yours, so a save landing mid-keystroke can't take the number out from under you. Changes arriving while you're typing are held and shown the moment you leave the field, the same way the shared Settle-up tab already worked.

  Two smaller fixes came along with it, both things the shared ledger already had and the private path never got: a save that finishes while you're still typing no longer marks your newest edits as saved, and writes are tagged so the app can recognize its own.

## [1.18.0] — 2026-07-26

### Added
- **Bills can be ticked off as paid.** Each bill has a checkbox: tick it when you pay early and it strikes through, shows a "paid" tag on the timeline, and stops counting against your available cash. Because that money has genuinely left your account, ticking also **subtracts the bill from your checking balance** — so available stays honest instead of jumping up by the bill amount. Unticking reverses both exactly.
- Bills **tick themselves once their date passes**, and now stay on the timeline for the rest of the pay period instead of silently rolling to next month, so you can see what's already cleared.

The auto-tick only adjusts checking for bills the app was tracking while they were still upcoming. A bill entered with a date already gone by is ticked without touching the balance, since the number you typed already accounts for it.

## [1.17.0] — 2026-07-25

### Added
- **Payday rollover nudge.** The first time you open the app after a payday passes, a bar appears on the Runway tab pointing out that your checking balance is probably stale. Typing your real bank balance is the primary action; the figure the app projected for that payday is offered underneath, and tapping "use it" only fills the box — you still confirm. Dismissible, shown once per payday, and never fires retroactively when you first set the app up.

### Fixed
- The nudge's "we projected $X" offer could never actually appear — the projection was overwritten with the *next* period's figure before the bar read it. It's now preserved until you acknowledge that payday. The bar also appears live if the app stays open across a payday (not just on reload), typing something non-numeric no longer silently sets checking to $0, and "use it" fills a clean two-decimal amount.

## [1.16.0] — 2026-07-25

### Added
- **Two-period projection.** The Next pay period block now chains the whole picture — what's left today, plus your next check, minus what that period costs — into a single "Projected by [date], before that check" figure. It answers whether you coast into the payday *after* next, not just the next one. Turns red if you'd land short, and hides itself when no paycheck is set up (there'd be nothing to project).
- **Split-in-half button on settle-up entries.** Enter the full bill you paid, tap **½**, and it halves to the other person's share — rounded to the cent, with no mental math.

## [1.15.0] — 2026-07-25

### Changed
- **New app icon** — the duct-taped wallet. Generated at every size from the source art: home-screen icons (192/512, with a maskable-safe margin so Android's circular crop doesn't clip it), an Apple touch icon, and browser favicons. The square crop drops the drawn-on white frame (the OS applies its own rounded corners) and the generator watermark, and the PWA splash background now matches the icon's green.

- The wallet also replaces the small gradient bar next to the **Runway** title in the header and on the sign-in card, so the logo is consistent everywhere.

### Fixed
- A debt payment landing beyond the next pay period was labelled "next period" regardless of how far out it was. It now says **"later"** unless it genuinely falls in the next window.
- **Closed a rapid-typing race in the shared ledger.** Postgres reorders JSON keys, so the app never recognized its own realtime echoes — and in a narrow window (your first save completing while you kept typing), a buffered echo could roll back and then re-save your newest keystrokes away. Writes are now tagged with a client rev id: own echoes are ignored outright, and a completed save no longer clears the pending flag when a newer edit is already queued.

## [1.14.0] — 2026-07-25

### Added
- **Loan payments.** Each loan takes a fixed monthly **payment** and a **due day** on the Net worth tab. The payment shows up on Runway alongside card payments, counts against your available cash, and lands on the timeline — and once the due date passes, **the payment actually comes off the loan balance**, so the number stays real without you touching it. Missed opens are caught up (three months away applies three payments), the balance never drops below zero, and adding a due day never charges you retroactively.

### Changed
- The Runway "Card payments" section is now **"Debt payments"**, covering both cards and loans. Card amounts stay editable (they vary); loan payments show as fixed values since they don't.

### Fixed
- **Typing a loan's due day could take a payment off the balance.** Entering a two-digit day briefly looked like a different, earlier schedule while you typed (the "1" of "15"), and finishing the number registered as a missed payment. The payment schedule now re-anchors whenever the due day changes, so editing it never charges you.

## [1.13.0] — 2026-07-25

### Added
- **Starting balances for the settle-up tab.** A one-line hint points out that you can add an entry called "Starting balance" on either side to carry over what's already owed — no special mechanism, just a normal dated entry, so it's visible in the list and clears with everything else when you settle up.
- **"Last updated" is now editable.** It still stamps itself whenever you change the lists, but you can backdate it to when you actually reconciled, with a "Today" button to snap it back.

## [1.12.0] — 2026-07-25

### Changed
- **Asset types are now self-explanatory.** The vague "Account / Investment / Report" is replaced by ten named types grouped by what they actually do, so the dropdown explains itself without extra text: **Dates itself when you update** (Checking, Savings, Cash, Other), **Dates itself + shows ▲▼** (Brokerage, Retirement / 401(k), Crypto), and **You set the date** (Vehicle, Real estate, Other valuable). A tooltip on the dropdown covers the detail. Existing assets migrate automatically with identical behavior — nothing to redo.

## [1.11.0] — 2026-07-25

### Added
- **"Next pay period" preview.** Below the timeline in the same card, a second block lists what falls in the window *after* your next payday — bills and card payments with their dates and a total. It's informational only: nothing there affects this period's available cash, and it's dimmed and labelled to make that clear. Hidden entirely when the next window is empty.

## [1.10.1] — 2026-07-25

### Changed
- **One-off entries can now be money in as well as money out.** The section is now "Extra money in & out" — each row has a **−/+** toggle, so a cash withdrawal or one-time expense lowers your available cash while a deposited check, a Venmo you received, or cashback raises it. Money-in entries show green with a **+** on the timeline and push the running balance up; the section footer shows the **net effect** for the period. Existing entries are unchanged (they stay money out).

## [1.10.0] — 2026-07-25

### Added
- **Credit card payment due dates.** Each card gets a due day (1–28 or EOM) on the Net worth tab, and a new **Card payments** section on Runway lists them by date. Enter the amount once you know it — cards vary month to month — and it counts against your available cash, lands on the timeline, and shows the card's **balance after** the payment. Amounts clear themselves the day after the due date passes, so each cycle starts blank. A card due *after* your next payday is shown but doesn't reduce this period's cash.

### Changed
- Card payments were previously logged as one-off payments linked to a card. That dropdown is retired — **card payments now have one home**, and the "Extra payments" section is purely for ad-hoc items (ATM withdrawals, one-time expenses), with shorter wording to match.

### Fixed
- **"Extra money in & out"** (formerly "Extra payments"): each entry now has a **−/+ toggle**, so the section covers deposits, Venmo, and cashback — not just money leaving checking. Money in raises your available cash instead of lowering it, shows as green on the timeline, and the section's total reflects the net of everything entered.

## [1.9.0] — 2026-07-25

### Added
- **Salaried and hourly pay types.** Salaried semi-monthly pay is the same every check (annual ÷ 24) and does *not* vary with weekdays, so it now has its own mode: enter your annual salary with a take-home %, or just enter your exact **take-home per check** off a pay stub — which is both simpler and more accurate than estimating taxes. Hourly keeps the weekday-based projection.
- **Hours can be entered per week or per day.** Enter 40/week (or 37.5, etc.) and the app converts to a per-weekday figure across the period's weekdays. The period summary now also shows total hours, e.g. "12 · 96 hrs".

## [1.8.0] — 2026-07-24

### Added
- **Paycheck projection built on weekdays, not calendar days.** Since pay lands on the 15th and the last day of the month, each period has a different number of weekdays (10–12), so the check varies. Enter a rate (per hour or per weekday), hours/day, take-home %, and any days off, and the app counts the weekdays in the current period and projects the check. Two new figures on the Runway summary: **Est. next check** and **Balance after payday**.
- **Live shared ledger updates.** When the Settle-up ledger is shared, the other person's edits now appear on your screen within seconds — no refresh — via a realtime subscription. It never overwrites a field you're actively typing in, and falls back to the existing refresh-on-return behavior if realtime isn't enabled.
- **"Settle up & clear."** One button records who paid whom, files it under **Past settle-ups**, wipes both lists for the next period, and stamps Last Venmo'd. History is capped at the 60 most recent and can be cleared separately.
- **Net worth over time.** The app records one net-worth point per day and draws a sparkline on the Net worth tab with the total change since the first point (green up / red down).
- **Installable as an app (PWA).** "Add to Home Screen" on your phone gives Runway its own icon and a full-screen, browser-chrome-free window. Adds a web manifest, icons, and theme colors.

### Fixed
- **Bill due days no longer fight you while typing.** The field was clamping on every keystroke, so typing "05" for the 5th became **15** (the leading `0` was snapped to `1` mid-type). Correction now happens when you leave the field. The range is also **1–28 or EOM** — days 29–31 don't exist in every month, so any existing bill saved on 29/30/31 is converted to **EOM**, which is what it always meant.
- Paycheck inputs are now clamped to sane values: **take-home % can't exceed 100** (1000% was multiplying the check 10×), **days off can't go negative** (which inflated the check) **or exceed the weekdays in the period** (which drove it negative), and a **blank hours/day falls back to 8** instead of silently projecting $0. Out-of-range entries are corrected on screen when you leave the field.
- A shared-ledger change arriving while you were typing in the Settle-up tab was **discarded**, leaving your screen quietly out of date. It's now held and applied the moment you leave the field (or once your own save finishes).
- Added a service worker so the app is **actually installable on Android** and the shell **works offline** with your last-synced data. It's network-first, so a new deploy always wins; Supabase traffic is never cached, so live data is never served stale.

## [1.7.0] — 2026-07-24

### Added
- **Shared Settle-up ledger.** The Settle-up tab can now be a single record shared between two specific accounts — editable and visible **only** to those accounts (enforced in Supabase). Everyone else keeps their own private settle-up automatically. Both participants are **named** (editable in-app), so the labels read correctly for whoever is viewing it (e.g. "Boston paid — Maria owes Boston"), and edits sync between the two like the rest of the app. Requires a one-time Supabase table + allowlist setup.

### Fixed
- Shared-ledger edits are now **flushed when you close or hide the tab** and **retried after a failure or when the connection returns** — matching the reliability of private saves (previously a last-second shared edit could be lost, and "will retry" never actually retried on the shared path).
- Returning to the tab no longer re-pulls the shared ledger while one of your shared edits is still saving, so it can't be clobbered by the older server copy.
- **Existing private settle-up entries migrate into the shared ledger** the first time it activates (only if the shared ledger has never been used), so your history isn't stranded when you switch to shared.
- The "Reset all data" dialog is now accurate in shared mode — it clarifies the shared ledger is not affected.
- Credit score input clamps to the real 300–850 range when you leave the field (no more "9999 · Excellent").

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
