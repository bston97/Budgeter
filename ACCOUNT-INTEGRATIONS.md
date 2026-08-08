# Account integrations — notes

Scratch file for thinking out loud about pulling real bank/card data into Penny Pincher via
an API, instead of typing figures in by hand. Nothing here is decided. This is a place to
argue with myself and leave the reasoning where I can find it later.

Companion to [ROADMAP.md](ROADMAP.md) (what to build) and [ARCHITECTURE.md](ARCHITECTURE.md)
(what to build it on). If any of this graduates into a real plan, it moves there.

---

## Why bother

Right now every number in the app is hand-entered. That's the app's biggest strength and
its biggest ceiling:

- **Strength** — it's honest. You enter it, you looked at it. Nothing is stale or wrong
  because a sync silently broke.
- **Ceiling** — it only works while you keep entering. The "last entered" timestamp above
  the tabs (1.28.0) exists precisely because staleness is the failure mode.

An integration trades that honesty for reach. Worth being clear-eyed that it's a trade, not
a pure win.

## What I'd actually want it to do

Rough priority order — worth arguing about:

1. **Balances.** Checking + each card. Kills the most common manual entry.
2. **Card minimum payments / statement balances.** Already modelled in the app (1.26.0);
   currently typed in.
3. **Transactions.** Much bigger surface. Do I actually want them, or do I only *think* I
   do because every other budgeting app has them?
4. **Pay detection.** Confirming the paycheque landed and for how much, against projection.

Open question: is (1) alone enough value to justify the whole integration layer? If yes,
that's a much smaller build than (3).

## Provider options to look at

Nothing evaluated yet — just the shortlist to research.

| Option | Notes to fill in |
|---|---|
| Plaid | The default answer. Cost? Free tier limits? |
| Teller | Cheaper/dev-friendlier reputation. Coverage? |
| MX / Finicity | Enterprise-shaped. Probably overkill. |
| Direct bank APIs | Only viable if my banks expose one. Most don't. |
| Open Banking (region-dependent) | Depends where the accounts actually are. |

Things to check for each: pricing at low volume, whether a personal/hobby project is even
allowed, sandbox quality, how long tokens live, what re-auth looks like when it breaks.

## The hard parts

Listed because these are what'll actually decide feasibility, not the happy path.

- **Secrets.** The app is a static site on GitHub Pages with Supabase behind it. There is
  no server to hold a provider secret. Anything requiring a confidential client needs an
  edge function or equivalent. This is probably the single biggest architectural
  consequence.
- **Token storage.** Access/refresh tokens per user, encrypted, never in the JSONB blob
  alongside ordinary ledger data. Needs its own thinking.
- **Multi-user.** Penny Pincher is genuinely multi-user (per ROADMAP). An integration isn't
  a personal convenience — it's a promise to every account holder, including about their
  bank credentials. Raises the bar a lot.
- **Offline-first.** The PWA works offline by design. A sync layer that assumes network
  breaks that. What's the offline story for stale-but-present integration data?
- **Failure modes.** Re-auth expiry, bank MFA changes, provider outages. What does the app
  show when the sync is three days old? Silent staleness is worse than no integration.
- **Cost.** Per-item monthly pricing on a free app I don't charge for.

## Manual entry doesn't go away

Whatever happens, hand entry stays as a first-class path — not a fallback. Reasons:

- Not every account will be connectable.
- Someone might not want to link a bank at all, and that should be a fully supported way
  to use the app.
- It's the offline path.

So the design question isn't "API vs manual", it's **how connected and manual figures
coexist in the same ledger without one quietly overwriting the other.** That's the part
worth getting right before any provider is chosen.

## Questions I haven't answered

- Read-only always, obviously — but does the app ever want to *initiate* anything (a card
  payment)? Instinct: no, never. Worth stating as a hard boundary if so.
- Does connected data become authoritative, or advisory alongside what I entered?
- What happens to history/projection accuracy tracking (`periodStats()`) when the inputs
  change source mid-stream?
- Is this actually the next thing worth building, or is it the shiny thing? Compare
  honestly against what's already in the roadmap.

## Next step

Nothing to build yet. Next action is research, not code: pick two providers, read their
actual pricing and personal-use terms, and find out whether the no-server constraint is a
blocker or just an edge function.
