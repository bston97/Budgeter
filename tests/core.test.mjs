// Run with:  node --test tests/
//
// No dependencies, no config, no build. These import js/core.js directly — the same file
// the browser loads — so they test the shipping code rather than a copy of it.
//
// Most cases below are named after the release that shipped the bug they pin.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  num, money, canon, mergeSections,
  stripTime, isoToDate, dateToISO, todayISO,
  nextPayday, mostRecentPayday, currentPeriod, payPeriodStart, countWeekdays,
  occurrenceInMonth, occurrenceInPeriod, occurrenceAfter, mostRecentOccurrence,
  billDate, billOccurrence, cardDueDate, cardPaymentPlacement, projectedCheck,
  recordPeriod, periodDelta, periodStats, sparkPoints, PERIOD_HISTORY_CAP
} from "../js/core.js";

// month is 1-based here so the cases read like dates
const D = (y, m, d) => new Date(y, m - 1, d);
const iso = (d) => (d === null ? "null" : dateToISO(d));
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, msg || `${a} !== ~${b}`);

// ---------------------------------------------------------------- parsing & formatting

test("num parses plain and messy input", () => {
  assert.equal(num("120"), 120);
  assert.equal(num("1,200.50"), 1200.50);
  assert.equal(num("$40"), 40);
  assert.equal(num("-25"), -25);
  assert.equal(num(""), 0);
  assert.equal(num("abc"), 0);
  assert.equal(num(null), 0);
  assert.equal(num(undefined), 0);
});

test("money formats, separates thousands, and never renders -$0.00 (1.3.0)", () => {
  assert.equal(money(0), "$0.00");
  assert.equal(money(-0.004), "$0.00", "tiny negative rounding must not show a minus");
  assert.equal(money(-0.006), "-$0.01");
  assert.equal(money(1234.5), "$1,234.50");
  assert.equal(money(-89.1), "-$89.10");
});

test("canon ignores object key order but not array order (1.15.2)", () => {
  // jsonb reorders keys on the way out, so a plain stringify can't tell changed from reordered
  assert.equal(canon({ a: 1, b: 2 }), canon({ b: 2, a: 1 }));
  assert.equal(canon({ x: { p: 1, q: 2 } }), canon({ x: { q: 2, p: 1 } }));
  assert.notEqual(canon({ a: 1 }), canon({ a: 2 }));
  assert.notEqual(canon([1, 2]), canon([2, 1]));
  assert.notEqual(canon(0), canon(null));
  assert.notEqual(canon(""), canon(null));
  assert.equal(canon(undefined), "null");
});

// ------------------------------------------------------------------------------ paydays

test("nextPayday from mid-month and month end", () => {
  assert.equal(iso(nextPayday(D(2026, 7, 1))), "2026-07-15");
  assert.equal(iso(nextPayday(D(2026, 7, 15))), "2026-07-31", "on the 15th, next is EOM");
  assert.equal(iso(nextPayday(D(2026, 7, 25))), "2026-07-31");
  assert.equal(iso(nextPayday(D(2026, 7, 31))), "2026-08-15", "on EOM, next is the 15th");
});

test("nextPayday crosses the year boundary", () => {
  assert.equal(iso(nextPayday(D(2026, 12, 15))), "2026-12-31");
  assert.equal(iso(nextPayday(D(2026, 12, 31))), "2027-01-15");
});

test("nextPayday handles February, leap and non-leap", () => {
  assert.equal(iso(nextPayday(D(2026, 2, 20))), "2026-02-28");
  assert.equal(iso(nextPayday(D(2028, 2, 20))), "2028-02-29");
});

test("mostRecentPayday on and around boundaries", () => {
  assert.equal(iso(mostRecentPayday(D(2026, 7, 15))), "2026-07-15", "on payday, that day counts");
  assert.equal(iso(mostRecentPayday(D(2026, 7, 16))), "2026-07-15");
  assert.equal(iso(mostRecentPayday(D(2026, 7, 1))), "2026-06-30");
  assert.equal(iso(mostRecentPayday(D(2027, 1, 1))), "2026-12-31", "must cross the year boundary");
});

test("currentPeriod runs from the day after last payday through the next", () => {
  const p = currentPeriod(D(2026, 7, 25));
  assert.equal(iso(p.start), "2026-07-16");
  assert.equal(iso(p.end), "2026-07-31");
  const q = currentPeriod(D(2026, 7, 15));
  assert.equal(iso(q.start), "2026-07-16", "on payday the new period has already begun");
  assert.equal(iso(q.end), "2026-07-31");
});

test("INVARIANT: every period is 16 days or fewer", () => {
  // occurrenceInPeriod's two-candidate scan is only correct while this holds
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 28; d++) {
      const p = currentPeriod(D(2026, m, d));
      const days = Math.round((p.end - p.start) / 86400000) + 1;
      assert.ok(days >= 1 && days <= 16, `period at ${iso(D(2026, m, d))} spans ${days} days`);
    }
  }
});

// -------------------------------------------------------------------------- occurrences

test("occurrenceInMonth clamps to the real last day (1.8.2)", () => {
  assert.equal(iso(occurrenceInMonth(31, 2026, 3)), "2026-04-30", "April has 30 days");
  assert.equal(iso(occurrenceInMonth(31, 2026, 1)), "2026-02-28");
  assert.equal(iso(occurrenceInMonth(30, 2028, 1)), "2028-02-29", "leap February");
  assert.equal(iso(occurrenceInMonth(15, 2026, 6)), "2026-07-15");
});

test("occurrenceInMonth handles EOM in every month length", () => {
  assert.equal(iso(occurrenceInMonth("EOM", 2026, 1)), "2026-02-28");
  assert.equal(iso(occurrenceInMonth("EOM", 2026, 3)), "2026-04-30");
  assert.equal(iso(occurrenceInMonth("EOM", 2026, 6)), "2026-07-31");
  assert.equal(iso(occurrenceInMonth("eom", 2026, 6)), "2026-07-31", "lowercase must work too");
});

test("occurrenceInPeriod finds a due day inside the window, and only inside", () => {
  const s = D(2026, 7, 16), e = D(2026, 7, 31);
  assert.equal(iso(occurrenceInPeriod(22, s, e)), "2026-07-22");
  assert.equal(occurrenceInPeriod(5, s, e), null, "the 5th is not in a 16th–31st window");
  assert.equal(iso(occurrenceInPeriod("EOM", s, e)), "2026-07-31");
  assert.equal(occurrenceInPeriod("", s, e), null);
});

test("occurrenceInPeriod includes both boundary days", () => {
  const s = D(2026, 7, 16), e = D(2026, 7, 31);
  assert.equal(iso(occurrenceInPeriod(16, s, e)), "2026-07-16", "start is inclusive");
  assert.equal(iso(occurrenceInPeriod(31, s, e)), "2026-07-31", "end is inclusive");
});

test("occurrenceInPeriod works when the window spans two months", () => {
  assert.equal(iso(occurrenceInPeriod(3, D(2026, 1, 1), D(2026, 1, 15))), "2026-01-03");
  assert.equal(iso(occurrenceInPeriod("EOM", D(2026, 12, 16), D(2026, 12, 31))), "2026-12-31");
});

test("billOccurrence resolves numeric days and EOM", () => {
  assert.equal(iso(billOccurrence({ due: "22" }, D(2026, 7, 10))), "2026-07-22");
  assert.equal(iso(billOccurrence({ due: "5" }, D(2026, 7, 10))), "2026-08-05", "already passed, roll forward");
  assert.equal(iso(billOccurrence({ due: "EOM" }, D(2026, 7, 10))), "2026-07-31");
  assert.equal(iso(billOccurrence({ due: "EOM" }, D(2026, 2, 10))), "2026-02-28");
  assert.equal(billOccurrence({ due: "" }, D(2026, 7, 10)), null);
  assert.equal(billOccurrence({ due: "0" }, D(2026, 7, 10)), null);
});

test("billOccurrence on the due day itself returns today, not next month", () => {
  assert.equal(iso(billOccurrence({ due: "22" }, D(2026, 7, 22))), "2026-07-22");
});

test("cardDueDate mirrors bills and rejects a blank day", () => {
  assert.equal(iso(cardDueDate({ dueDay: "12" }, D(2026, 7, 5))), "2026-07-12");
  assert.equal(cardDueDate({ dueDay: "" }, D(2026, 7, 5)), null);
});

// ------------------------------------------------------- card payments land in the period
// they were typed in (1.23.0). Scenario throughout: paying two cards on the same day when
// only one of them is due this cycle.

test("a payment typed for a due date later this period stays on the due date (1.23.0)", () => {
  const today = D(2026, 7, 2);
  const p = cardPaymentPlacement({ payAmount: "200", paidOn: "2026-07-02" },
                                 D(2026, 7, 5), currentPeriod(today), today);
  assert.equal(iso(p.when), "2026-07-05", "still ahead and inside this period — leave it where it falls");
  assert.equal(p.settled, false);
});

test("a payment for a due date in a later period lands today instead (1.23.0)", () => {
  const today = D(2026, 7, 29); // period is Jul 16–31; the card is not due until Aug 20
  const p = cardPaymentPlacement({ payAmount: "200", paidOn: "2026-07-29" },
                                 D(2026, 8, 20), currentPeriod(today), today);
  assert.equal(iso(p.when), "2026-07-29", "the money left the day it was typed, not next month");
  assert.equal(p.settled, false, "it must still be charged to the period it was typed in");
});

test("paying after the due date has passed lands today, not on next month's date (1.23.0)", () => {
  const today = D(2026, 7, 22);
  const p = cardPaymentPlacement({ payAmount: "150", paidOn: "2026-07-22" },
                                 D(2026, 8, 20), currentPeriod(today), today);
  assert.equal(iso(p.when), "2026-07-22");
  assert.equal(p.settled, false);
});

test("the period holding the due date sees the payment as settled (1.23.0)", () => {
  const today = D(2026, 8, 18); // period Aug 16–31, where the Aug 20 due date falls
  const p = cardPaymentPlacement({ payAmount: "200", paidOn: "2026-07-29" },
                                 D(2026, 8, 20), currentPeriod(today), today);
  assert.equal(p.settled, true, "paid in an earlier period — this one must not charge it again");
  assert.equal(iso(p.paidOn), "2026-07-29", "and must be able to name when it went out");
  near(p.amount, 200);
});

test("a payment made earlier in the same period is not settled (1.23.0)", () => {
  const today = D(2026, 7, 30);
  const p = cardPaymentPlacement({ payAmount: "200", paidOn: "2026-07-20" },
                                 D(2026, 8, 20), currentPeriod(today), today);
  assert.equal(p.settled, false, "same period, so the money is still this period's business");
  assert.equal(iso(p.when), "2026-07-20");
});

test("a record with no paidOn keeps the old due-date meaning (1.23.0)", () => {
  const today = D(2026, 7, 29);
  const p = cardPaymentPlacement({ payAmount: "200" }, D(2026, 8, 20), currentPeriod(today), today);
  assert.equal(iso(p.when), "2026-08-20", "data written before paidOn existed must not jump periods");
  assert.equal(p.settled, false);
});

test("nothing to place without an amount (1.23.0)", () => {
  const today = D(2026, 7, 29), per = currentPeriod(today), due = D(2026, 8, 20);
  assert.equal(cardPaymentPlacement({ payAmount: "", paidOn: "2026-07-29" }, due, per, today), null);
  assert.equal(cardPaymentPlacement({ payAmount: "0", paidOn: "2026-07-29" }, due, per, today), null);
  assert.equal(cardPaymentPlacement({ payAmount: "-50", paidOn: "2026-07-29" }, due, per, today), null);
  assert.equal(cardPaymentPlacement({ payAmount: "200" }, null, per, today), null, "no due date, no paidOn");
});

test("paying both cards on one day charges both to that period (1.23.0)", () => {
  const today = D(2026, 7, 29), per = currentPeriod(today);
  const soon = cardPaymentPlacement({ payAmount: "100", paidOn: "2026-07-29" }, D(2026, 8, 5), per, today);
  const later = cardPaymentPlacement({ payAmount: "200", paidOn: "2026-07-29" }, D(2026, 8, 20), per, today);
  // neither due date is in this period, but the money for both is gone today
  assert.equal(iso(soon.when), "2026-07-29");
  assert.equal(iso(later.when), "2026-07-29");
  assert.equal(soon.settled || later.settled, false);
});

// currentPeriod on a payday has already rolled to the window that payday opens, so a
// payment typed that day sits one day before period.start. It must charge the new
// period — settling it instantly would charge it to no period at all (1.24.0).
test("a payment typed on the 15th payday is charged, not settled (1.24.0)", () => {
  const today = D(2026, 7, 15); // payday; currentPeriod is Jul 16–31
  const p = cardPaymentPlacement({ payAmount: "200", paidOn: "2026-07-15" },
                                 D(2026, 7, 20), currentPeriod(today), today);
  assert.equal(p.settled, false, "typed on payday — some period must still charge it");
  assert.equal(iso(p.when), "2026-07-20", "due date is ahead and inside the new period");
});

test("a payment typed on an EOM payday is charged, not settled (1.24.0)", () => {
  const today = D(2026, 7, 31); // EOM payday; currentPeriod is Aug 1–15
  const p = cardPaymentPlacement({ payAmount: "150", paidOn: "2026-07-31" },
                                 D(2026, 8, 7), currentPeriod(today), today);
  assert.equal(p.settled, false);
  assert.equal(iso(p.when), "2026-08-07");
});

test("a payment from the day before the payday still settles the next period (1.24.0)", () => {
  const today = D(2026, 8, 1); // period Aug 1–15, opened by the Jul 31 payday
  const p = cardPaymentPlacement({ payAmount: "150", paidOn: "2026-07-30" },
                                 D(2026, 8, 7), currentPeriod(today), today);
  assert.equal(p.settled, true, "left before the payday that opened this period");
  assert.equal(iso(p.when), "2026-07-30", "a settled payment names the day it went out");
});

test("a payment with a due date the user since cleared still charges on paidOn (1.24.0)", () => {
  const today = D(2026, 7, 22), per = currentPeriod(today);
  const p = cardPaymentPlacement({ payAmount: "80", paidOn: "2026-07-22" }, null, per, today);
  assert.equal(p.settled, false);
  assert.equal(iso(p.when), "2026-07-22", "no due date to sit on — the money still left today");
});

test("billDate clamps a 31st to short months", () => {
  assert.equal(iso(billDate(31, D(2026, 4, 1))), "2026-04-30");
  assert.equal(iso(billDate(31, D(2026, 2, 1))), "2026-02-28");
});

test("mostRecentOccurrence walks back, including across a year", () => {
  assert.equal(iso(mostRecentOccurrence(15, D(2026, 7, 20))), "2026-07-15");
  assert.equal(iso(mostRecentOccurrence(25, D(2026, 7, 20))), "2026-06-25", "not due yet this month");
  assert.equal(iso(mostRecentOccurrence(15, D(2026, 1, 5))), "2025-12-15", "must cross into last year");
});

test("a half-typed due day resolves to a different date (1.14.1)", () => {
  // typing "15" passes through "1"; if that registered as a missed payment it charged the loan
  const typing = mostRecentOccurrence(1, D(2026, 7, 20));
  const done = mostRecentOccurrence(15, D(2026, 7, 20));
  assert.equal(iso(typing), "2026-07-01");
  assert.equal(iso(done), "2026-07-15");
  assert.notEqual(+typing, +done, "these must differ — which is why the schedule re-anchors");
});

test("occurrenceAfter always lands strictly after the given date", () => {
  assert.equal(iso(occurrenceAfter(15, D(2026, 7, 15))), "2026-08-15", "same day does not count");
  assert.equal(iso(occurrenceAfter(20, D(2026, 7, 15))), "2026-07-20");
});

// ------------------------------------------------------------------ weekdays & paycheck

test("payPeriodStart splits the month correctly", () => {
  assert.equal(iso(payPeriodStart(D(2026, 7, 15))), "2026-07-01");
  assert.equal(iso(payPeriodStart(D(2026, 7, 31))), "2026-07-16");
  assert.equal(iso(payPeriodStart(D(2026, 2, 28))), "2026-02-16");
});

test("countWeekdays excludes weekends", () => {
  assert.equal(countWeekdays(D(2026, 7, 6), D(2026, 7, 10)), 5, "a full Mon–Fri");
  assert.equal(countWeekdays(D(2026, 7, 11), D(2026, 7, 12)), 0, "a weekend alone");
  assert.equal(countWeekdays(D(2026, 7, 6), D(2026, 7, 6)), 1, "a single weekday");
});

test("INVARIANT: every 2026 semi-monthly period has 10–12 weekdays", () => {
  for (let m = 1; m <= 12; m++) {
    for (const pd of [D(2026, m, 15), new Date(2026, m, 0)]) {
      const w = countWeekdays(payPeriodStart(pd), pd);
      assert.ok(w >= 10 && w <= 12, `period ending ${iso(pd)} has ${w} weekdays`);
    }
  }
});

test("salary mode: the entered per-check take-home is used as-is (1.22.0)", () => {
  const r = projectedCheck({ mode: "salary", netCheck: "2000" }, D(2026, 7, 15));
  near(r.net, 2000, "what you typed is what lands");
  near(r.gross, 2000, "there is no gross to estimate any more");
});

test("salary mode ignores take-home % and days off (1.22.0)", () => {
  const plain = projectedCheck({ mode: "salary", netCheck: "1800" }, D(2026, 7, 15));
  const noisy = projectedCheck({ mode: "salary", netCheck: "1800", takeHome: "50", daysOff: "5" }, D(2026, 7, 15));
  near(noisy.net, plain.net, "leftover hourly settings must not touch a salaried check");
});

test("salary mode is the same in every period, whatever the weekdays (1.22.0)", () => {
  const a = projectedCheck({ mode: "salary", netCheck: "1800" }, D(2026, 7, 15));
  const b = projectedCheck({ mode: "salary", netCheck: "1800" }, D(2026, 7, 31));
  near(a.net, b.net);
});

test("salary mode returns null with nothing entered", () => {
  assert.equal(projectedCheck({ mode: "salary", netCheck: "" }, D(2026, 7, 15)), null);
  assert.equal(projectedCheck({ mode: "salary", netCheck: "-500" }, D(2026, 7, 15)), null,
    "a negative check is not a check");
});

test("hourly: rate x hours x weekdays worked", () => {
  const pay = { mode: "hourly", rate: "20", per: "hour", hours: "8", hoursUnit: "day", takeHome: "100", daysOff: "" };
  const r = projectedCheck(pay, D(2026, 7, 15));
  assert.equal(r.worked, r.weekdays, "no days off means every weekday is worked");
  near(r.gross, r.worked * 160);
  near(r.net, r.gross);
});

test("take-home above 100% is clamped, not multiplied (1.8.1)", () => {
  const pay = { mode: "hourly", rate: "20", per: "hour", hours: "8", hoursUnit: "day", takeHome: "1000", daysOff: "" };
  const r = projectedCheck(pay, D(2026, 7, 15));
  near(r.net, r.gross, "1000% must clamp to 100%");
});

test("days off cannot go negative or exceed the period (1.8.1)", () => {
  const base = { mode: "hourly", rate: "20", per: "hour", hours: "8", hoursUnit: "day", takeHome: "100" };
  const neg = projectedCheck({ ...base, daysOff: "-5" }, D(2026, 7, 15));
  assert.equal(neg.worked, neg.weekdays, "negative days off must not inflate the check");
  const over = projectedCheck({ ...base, daysOff: "99" }, D(2026, 7, 15));
  assert.equal(over.worked, 0, "days off beyond the period floor at zero worked");
  assert.ok(over.net >= 0, "net must never go negative");
});

test("blank hours falls back to the placeholder, not zero (1.8.1)", () => {
  const day = projectedCheck({ mode: "hourly", rate: "20", per: "hour", hours: "", hoursUnit: "day", takeHome: "100", daysOff: "" }, D(2026, 7, 15));
  assert.equal(day.hoursPerWeekday, 8, "blank must fall back to 8/day");
  const week = projectedCheck({ mode: "hourly", rate: "20", per: "hour", hours: "", hoursUnit: "week", takeHome: "100", daysOff: "" }, D(2026, 7, 15));
  assert.equal(week.hoursPerWeekday, 8, "blank weekly must fall back to 40/wk = 8/day");
});

test("hours entered per week convert to per weekday (1.9.0)", () => {
  const r = projectedCheck({ mode: "hourly", rate: "20", per: "hour", hours: "37.5", hoursUnit: "week", takeHome: "100", daysOff: "" }, D(2026, 7, 15));
  near(r.hoursPerWeekday, 7.5);
});

test("a per-day rate ignores hours entirely", () => {
  const r = projectedCheck({ mode: "hourly", rate: "200", per: "day", hours: "8", hoursUnit: "day", takeHome: "100", daysOff: "" }, D(2026, 7, 15));
  near(r.gross, r.worked * 200);
});

test("hourly returns null with no rate", () => {
  assert.equal(projectedCheck({ mode: "hourly", rate: "", per: "hour", hours: "8", hoursUnit: "day", takeHome: "100", daysOff: "" }, D(2026, 7, 15)), null);
});

// -------------------------------------------------------------------------- iso helpers

test("dateToISO pads, and round-trips through isoToDate with no timezone drift", () => {
  assert.equal(dateToISO(D(2026, 7, 5)), "2026-07-05");
  assert.equal(dateToISO(D(2026, 12, 31)), "2026-12-31");
  assert.equal(dateToISO(isoToDate("2026-02-28")), "2026-02-28");
  assert.equal(+isoToDate("2026-07-05"), +D(2026, 7, 5));
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test("stripTime discards the clock", () => {
  const d = new Date(2026, 6, 5, 23, 47, 11);
  assert.equal(stripTime(d).getHours(), 0);
  assert.equal(dateToISO(stripTime(d)), "2026-07-05");
});

// -------------------------------------------------------------------------------- merge

const clone = (o) => JSON.parse(JSON.stringify(o));

test("HEADLINE: edits to different sections both survive (1.18.1)", () => {
  const base = { checking: "100", bills: [{ name: "Rent", amount: "1200" }], creditScore: "700" };
  const local = { checking: "250", bills: [{ name: "Rent", amount: "1200" }], creditScore: "700" };
  const remote = { checking: "100", bills: [{ name: "Rent", amount: "1300" }], creditScore: "700" };
  const { merged } = mergeSections(local, clone(remote), base);
  assert.equal(merged.checking, "250", "our checking edit was lost");
  assert.equal(merged.bills[0].amount, "1300", "their bills edit was lost");
});

test("an untouched section takes the remote value", () => {
  const { merged } = mergeSections(
    { checking: "100", creditScore: "700" },
    { checking: "100", creditScore: "780" },
    { checking: "100", creditScore: "700" });
  assert.equal(merged.creditScore, "780");
});

test("when both sides changed the same section, remote wins", () => {
  const { merged } = mergeSections({ checking: "250" }, { checking: "900" }, { checking: "100" });
  assert.equal(merged.checking, "900");
});

test("a stale device with no local edits never clobbers newer remote data", () => {
  const base = { checking: "100", bills: [], assets: [] };
  const { merged } = mergeSections(clone(base),
    { checking: "900", bills: [{ name: "Gym", amount: "40" }], assets: [] }, base);
  assert.equal(merged.checking, "900");
  assert.equal(merged.bills.length, 1);
});

test("with no base (offline at sign-in) local is kept, matching pre-1.18.1 behavior", () => {
  const { merged } = mergeSections(
    { checking: "250", creditScore: "700" },
    { checking: "900", creditScore: "780" }, null);
  assert.equal(merged.checking, "250");
  assert.equal(merged.creditScore, "700");
});

test("jsonb key reordering is not mistaken for an edit (1.15.2)", () => {
  const base = { pay: { mode: "hourly", rate: "20" } };
  const { merged } = mergeSections(
    { pay: { mode: "hourly", rate: "20" } },
    { pay: { rate: "20", mode: "hourly" } }, base);
  assert.equal(canon(merged.pay), canon(base.pay));
});

test("_rev is never merged as data; the remote one survives", () => {
  const { merged } = mergeSections(
    { checking: "250", _rev: "r1" },
    { checking: "100", _rev: "r2" },
    { checking: "100", _rev: "r1" });
  assert.equal(merged._rev, "r2");
});

test("the field being typed in is protected, and their new bill still lands", () => {
  const base = { checking: "100", bills: [] };
  const { merged } = mergeSections(
    { checking: "12", bills: [] },                                  // mid-typing "125"
    { checking: "100", bills: [{ name: "Gym", amount: "40" }] }, base);
  assert.equal(merged.checking, "12", "keystroke in progress was clobbered");
  assert.equal(merged.bills.length, 1, "their new bill was lost");
});

test("a row deleted remotely and untouched locally stays deleted", () => {
  const base = { bills: [{ name: "Gym", amount: "40" }], checking: "100" };
  const { merged } = mergeSections(clone(base), { bills: [], checking: "100" }, base);
  assert.deepEqual(merged.bills, []);
});

test("REGRESSION: identical sections keep object identity (1.19.1)", () => {
  // `incoming` is parsed fresh; equal-but-different objects would orphan every row handler
  // on screen and silently swallow the next keystroke
  const bills = [{ name: "Rent", amount: "1200" }];
  const { merged } = mergeSections(
    { checking: "100", bills },
    { checking: "900", bills: [{ name: "Rent", amount: "1200" }] },
    { checking: "100", bills: [{ name: "Rent", amount: "1200" }] });
  assert.equal(merged.bills, bills, "array replaced despite identical content");
  assert.equal(merged.bills[0], bills[0], "item replaced despite identical content");
  assert.equal(merged.checking, "900", "the genuinely-changed section still comes from remote");
});

test("sections we edited keep identity too (1.19.1)", () => {
  const bills = [{ name: "Rent", amount: "1300" }];
  const { merged } = mergeSections(
    { bills, checking: "100" },
    { bills: [{ name: "Rent", amount: "1200" }], checking: "100" },
    { bills: [{ name: "Rent", amount: "1200" }], checking: "100" });
  assert.equal(merged.bills, bills, "our edited array must be kept as-is");
});

test("only genuinely replaced lists are reported stale (1.19.1)", () => {
  const base = { bills: [{ name: "Rent", amount: "1200" }], assets: [] };
  const { stale } = mergeSections(clone(base),
    { bills: [{ name: "Rent", amount: "1300" }], assets: [] }, base);
  assert.deepEqual(stale, ["bills"], "only the replaced section should be flagged");
});

test("nothing is flagged stale when we keep our own edits (1.19.1)", () => {
  const { stale } = mergeSections(
    { bills: [{ name: "Rent", amount: "1300" }] },
    { bills: [{ name: "Rent", amount: "1200" }] },
    { bills: [{ name: "Rent", amount: "1200" }] });
  assert.deepEqual(stale, []);
});

test("a reset (no base, cleared state) keeps the cleared values (1.18.1)", () => {
  const cleared = { checking: "", bills: [], assets: [], creditScore: "" };
  const { merged } = mergeSections(cleared, {
    checking: "900",
    bills: [{ name: "Rent", amount: "1200" }],
    assets: [{ name: "Savings", balance: "500" }],
    creditScore: "780"
  }, null);
  assert.equal(merged.checking, "");
  assert.equal(merged.bills.length, 0);
  assert.equal(merged.assets.length, 0);
  assert.equal(merged.creditScore, "");
});

// ----------------------------------------------------------------------- period history

test("recordPeriod appends a period and leaves the input alone", () => {
  const before = [];
  const after = recordPeriod(before, { d: "2026-07-31", p: 1240.55, a: 1118.02 });
  assert.equal(before.length, 0, "must be pure — the caller's array is untouched");
  assert.deepEqual(after, [{ d: "2026-07-31", p: 1240.55, a: 1118.02 }]);
});

test("recordPeriod corrects a payday already recorded instead of duplicating it", () => {
  let h = recordPeriod([], { d: "2026-07-31", p: 1200, a: 1100 });
  h = recordPeriod(h, { d: "2026-08-15", p: 900, a: 950 });
  h = recordPeriod(h, { d: "2026-07-31", p: 1200, a: 1075 });   // corrected a typo
  assert.equal(h.length, 2, "same payday must not add a second row");
  assert.equal(h[0].a, 1075, "the correction should win");
  assert.equal(h[0].d, "2026-07-31", "and keep its position in the series");
  assert.equal(h[1].d, "2026-08-15");
});

test("recordPeriod keeps a payday with no projection, with p null", () => {
  const h = recordPeriod([], { d: "2026-07-31", p: null, a: 1118.02 });
  assert.equal(h.length, 1);
  assert.equal(h[0].p, null);
  assert.equal(periodDelta(h[0]), null, "no projection means no delta to show");
});

test("recordPeriod refuses to invent an actual", () => {
  // dismissing the nudge means we never learned the real balance
  assert.deepEqual(recordPeriod([], { d: "2026-07-31", p: 1200, a: undefined }), []);
  assert.deepEqual(recordPeriod([], { d: "2026-07-31", p: 1200, a: NaN }), []);
  assert.deepEqual(recordPeriod([], { d: "2026-07-31", p: 1200 }), []);
  assert.deepEqual(recordPeriod([], { d: "", p: 1200, a: 10 }), [], "a payday needs a date");
  assert.deepEqual(recordPeriod([], null), []);
});

test("recordPeriod records a zero balance, which is real data", () => {
  const h = recordPeriod([], { d: "2026-07-31", p: 1200, a: 0 });
  assert.equal(h.length, 1);
  assert.equal(h[0].a, 0);
  assert.equal(periodDelta(h[0]), -1200);
});

test("recordPeriod caps the series and keeps the newest", () => {
  let h = [];
  for (let i = 1; i <= 60; i++) h = recordPeriod(h, { d: "2026-01-" + String(i).padStart(2, "0"), p: 100, a: 100 + i }, 48);
  assert.equal(h.length, 48);
  assert.equal(h[h.length - 1].a, 160, "the most recent entry must survive");
  assert.equal(h[0].a, 113, "the oldest 12 are dropped");
});

test("PERIOD_HISTORY_CAP is the default cap", () => {
  let h = [];
  for (let i = 0; i < PERIOD_HISTORY_CAP + 5; i++) h = recordPeriod(h, { d: "d" + i, p: 1, a: 2 });
  assert.equal(h.length, PERIOD_HISTORY_CAP);
});

test("periodDelta is actual minus projected, signed the intuitive way", () => {
  assert.equal(periodDelta({ d: "x", p: 1200, a: 1100 }), -100, "landing short is negative");
  assert.equal(periodDelta({ d: "x", p: 1200, a: 1350 }), 150, "landing over is positive");
  assert.equal(periodDelta({ d: "x", p: 1200, a: 1200 }), 0);
  assert.equal(periodDelta({ d: "x", p: null, a: 1100 }), null);
  assert.equal(periodDelta(null), null);
});

test("periodStats averages only the periods that can be compared", () => {
  const h = [
    { d: "a", p: 1000, a: 900 },    // -100
    { d: "b", p: null, a: 800 },    // no projection, excluded
    { d: "c", p: 1000, a: 860 }     // -140
  ];
  const s = periodStats(h);
  assert.equal(s.n, 2, "the entry without a projection must not count");
  near(s.avg, -120);
  assert.equal(s.under, 2);
  near(s.last, -140);
});

test("periodStats is null until something is comparable", () => {
  assert.equal(periodStats([]), null);
  assert.equal(periodStats(null), null);
  assert.equal(periodStats([{ d: "a", p: null, a: 500 }]), null, "actuals alone are not a comparison");
});

test("periodStats counts periods over projection separately", () => {
  const s = periodStats([
    { d: "a", p: 1000, a: 1100 },
    { d: "b", p: 1000, a: 900 },
    { d: "c", p: 1000, a: 1000 }
  ]);
  assert.equal(s.n, 3);
  assert.equal(s.under, 1, "zero is not under");
  near(s.avg, 0);
});

test("sparkPoints spans the box and inverts y so bigger is higher", () => {
  const pts = sparkPoints([0, 10], 300, 48, 4);
  assert.equal(pts.length, 2);
  assert.equal(pts[0][0], 0);
  assert.equal(pts[1][0], 300);
  assert.ok(pts[0][1] > pts[1][1], "the larger value must sit higher on screen");
});

test("sparkPoints handles a flat series without dividing by zero", () => {
  const pts = sparkPoints([5, 5, 5], 300, 48, 4);
  assert.equal(pts.length, 3);
  for (const p of pts) assert.ok(isFinite(p[1]), "flat series produced a non-finite y");
});

test("sparkPoints handles one point and none at all", () => {
  assert.deepEqual(sparkPoints([], 300, 48, 4), []);
  const one = sparkPoints([7], 300, 48, 4);
  assert.equal(one.length, 1);
  assert.equal(one[0][0], 300, "a lone point sits at the right edge, where 'now' is");
});

test("sparkPoints keeps every point inside the padded box", () => {
  const pts = sparkPoints([-40, 0, 125, 3], 300, 48, 4);
  for (const [x, y] of pts) {
    assert.ok(x >= 0 && x <= 300, `x ${x} out of box`);
    assert.ok(y >= 4 && y <= 44, `y ${y} outside the padded box`);
  }
});
