/* Penny Pincher — pure core.
 *
 * Date, money and projection logic with no DOM and no app state. Everything here is a
 * function of its arguments, which is the whole point: this is the code the changelog
 * shows getting fixed after the fact, and it is now testable before it ships.
 *
 * Runs untranspiled in the browser (via <script type="module">) and in Node (via
 * `node --test tests/`). No build step, no dependencies.
 */

// ---------- parsing & formatting ----------

export function num(v) {
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function money(n) {
  if (Math.abs(n) < 0.005) n = 0; // avoid rendering "-$0.00" from tiny rounding
  var neg = n < 0;
  var s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (neg ? "-$" : "$") + s;
}

// Stable stringify for comparing two copies of a section: jsonb reorders object keys on
// the way back out, so a plain JSON.stringify can't tell "changed" from "reordered".
export function canon(v) {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  return "{" + Object.keys(v).sort().map(function (k) {
    return JSON.stringify(k) + ":" + canon(v[k]);
  }).join(",") + "}";
}

// ---------- cross-device merge ----------

// Which on-screen list each state section draws into, so a merge can report whether the
// rows someone is about to type into are still bound to objects that exist.
export var SECTION_BOXES = {
  bills: ["bills"], oneoffs: ["oneoffs"], cards: ["cards"],
  loans: ["loans"], assets: ["assets"], settle: ["sheOwes", "iOwe"]
};

/**
 * Reconcile our state with the server's, section by section, against the copy we last
 * synced. Sections only we touched are kept, sections only they touched are taken, and
 * when both changed the same one theirs wins — it reached the server first.
 *
 * `incoming` is taken over and returned as the merged result, so the caller should pass a
 * copy it owns. Sections whose content already matches keep OUR objects: `incoming` is
 * parsed fresh, and swapping in equal-but-different objects would orphan the row handlers
 * already on screen and silently drop whatever gets typed next.
 *
 * Returns { merged, stale } where `stale` names the on-screen lists that were genuinely
 * replaced and therefore need rebuilding before anyone types into them.
 */
export function mergeSections(local, incoming, base) {
  var was = base || {};
  var stale = [];
  var keys = {};
  Object.keys(local).forEach(function (k) { keys[k] = 1; });
  Object.keys(incoming).forEach(function (k) { keys[k] = 1; });
  Object.keys(keys).forEach(function (k) {
    if (k === "_rev") return;
    var mine = canon(local[k]), theirs = canon(incoming[k]);
    if (mine === theirs) { incoming[k] = local[k]; return; }   // same content, keep our objects
    // Never pulled this session (offline at sign-in), so there's no basis for telling who
    // changed what. Keep ours rather than dropping what was just typed on this device.
    if (!base) { incoming[k] = local[k]; return; }
    if (mine !== canon(was[k]) && theirs === canon(was[k])) { incoming[k] = local[k]; return; }
    if (SECTION_BOXES[k]) stale = stale.concat(SECTION_BOXES[k]);
  });
  return { merged: incoming, stale: stale };
}

// ---------- dates ----------

export function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isoToDate(iso) {
  var p = String(iso).split("-");
  return new Date(+p[0], (+p[1] - 1), +p[2]);
}

export function dateToISO(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function todayISO() { return dateToISO(new Date()); }

// ---------- paydays & periods ----------
// Pay lands on the 15th and the last day of each month.

export function nextPayday(today) {
  var t = stripTime(today);
  var list = [];
  for (var k = 0; k <= 2; k++) {
    var mm = t.getMonth() + k;
    list.push(new Date(t.getFullYear(), mm, 15));
    list.push(new Date(t.getFullYear(), mm + 1, 0));
  }
  list.sort(function (a, b) { return a - b; });
  for (var i = 0; i < list.length; i++) if (list[i] > t) return list[i];
  return list[0];
}

// most recent payday on or before `today`
export function mostRecentPayday(today) {
  var t = stripTime(today);
  var list = [];
  for (var k = -2; k <= 0; k++) {
    var mm = t.getMonth() + k;
    list.push(new Date(t.getFullYear(), mm, 15));
    list.push(new Date(t.getFullYear(), mm + 1, 0));
  }
  list.sort(function (a, b) { return b - a; });
  for (var i = 0; i < list.length; i++) if (list[i] <= t) return list[i];
  return null;
}

// The pay period surrounding today: the day after the last payday, through the next one.
export function currentPeriod(today) {
  var t = stripTime(today);
  var end = nextPayday(t);
  var last = mostRecentPayday(t);
  var start = last ? new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1) : t;
  return { start: start, end: end };
}

// Semi-monthly pay period ending on the given payday: the 15th covers the 1st–15th,
// EOM covers the 16th–end.
export function payPeriodStart(payday) {
  return payday.getDate() === 15
    ? new Date(payday.getFullYear(), payday.getMonth(), 1)
    : new Date(payday.getFullYear(), payday.getMonth(), 16);
}

export function countWeekdays(start, end) {
  var n = 0, d = stripTime(start), last = stripTime(end);
  while (d <= last) {
    var w = d.getDay();
    if (w !== 0 && w !== 6) n++;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return n;
}

// ---------- due-day occurrences ----------
// A due day is a number 1–28, or "EOM" for the last day of the month.

// the due-day occurrence within a specific month, clamped like bills (EOM = last day)
export function occurrenceInMonth(dueDay, y, m) {
  var lastDay = new Date(y, m + 1, 0).getDate();
  var day = String(dueDay).toUpperCase() === "EOM" ? lastDay : Math.min(parseInt(dueDay, 10) || 1, lastDay);
  return new Date(y, m, day);
}

// A bill's occurrence inside a given window (periods are ≤16 days, so at most one).
export function occurrenceInPeriod(dueDay, start, end) {
  if (!dueDay) return null;
  var cands = [
    occurrenceInMonth(dueDay, start.getFullYear(), start.getMonth()),
    occurrenceInMonth(dueDay, end.getFullYear(), end.getMonth())
  ];
  for (var i = 0; i < cands.length; i++) {
    if (cands[i] >= start && cands[i] <= end) return cands[i];
  }
  return null;
}

export function occurrenceAfter(dueDay, after) {
  var o = occurrenceInMonth(dueDay, after.getFullYear(), after.getMonth());
  return o > after ? o : occurrenceInMonth(dueDay, after.getFullYear(), after.getMonth() + 1);
}

export function mostRecentOccurrence(dueDay, today) {
  var o = occurrenceInMonth(dueDay, today.getFullYear(), today.getMonth());
  return o <= today ? o : occurrenceInMonth(dueDay, today.getFullYear(), today.getMonth() - 1);
}

export function billDate(dueDay, today) {
  var t = stripTime(today);
  function make(monthOffset) {
    var y = t.getFullYear(), m = t.getMonth() + monthOffset;
    var lastDay = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(dueDay, lastDay));
  }
  var d = make(0);
  if (d < t) d = make(1);
  return d;
}

// resolve a bill's next occurrence; supports a numeric day (1–31) or "EOM" = end of month
export function billOccurrence(bill, today) {
  var eom = String(bill.due).toUpperCase() === "EOM";
  var dueDay = eom ? 31 : parseInt(bill.due, 10);
  if (isNaN(dueDay) || dueDay < 1) return null;
  return billDate(dueDay, today); // billDate clamps to the month's last day
}

// next occurrence of a credit card's payment due date (same 1–28 / EOM rules as bills)
export function cardDueDate(card, today) {
  if (!card.dueDay) return null;
  return billOccurrence({ due: card.dueDay }, today);
}

// ---------- paycheck projection ----------

export var PERIODS_PER_YEAR = 24; // semi-monthly: the 15th and the last day

// Projected take-home for the period ending on `payday`, based on weekdays actually
// worked. Takes the pay settings explicitly rather than reaching for global state, which
// is the one change made while extracting this file — it is what makes it testable.
export function projectedCheck(p, payday) {
  var weekdays = countWeekdays(payPeriodStart(payday), payday);
  var takeHome = p.takeHome === "" ? 100 : Math.max(0, Math.min(100, num(p.takeHome)));

  if (p.mode === "salary") {
    // Salaried semi-monthly pay is the same every period — weekday count doesn't change it.
    var exact = Math.max(0, num(p.netCheck));
    if (exact > 0) return { mode: "salary", exact: true, weekdays: weekdays, gross: exact, net: exact };
    var salary = Math.max(0, num(p.salary));
    if (salary <= 0) return null;
    var grossCheck = salary / PERIODS_PER_YEAR;
    return { mode: "salary", exact: false, weekdays: weekdays, gross: grossCheck, net: grossCheck * (takeHome / 100) };
  }

  var rate = Math.max(0, num(p.rate));
  if (rate <= 0) return null;
  // days off can only remove days you'd actually work
  var worked = weekdays - Math.min(weekdays, Math.max(0, num(p.daysOff)));
  var perWeek = p.hoursUnit === "week";
  var hours = p.hours === "" ? (perWeek ? 40 : 8) : Math.max(0, num(p.hours)); // blank falls back to the placeholder
  var hoursPerWeekday = perWeek ? hours / 5 : hours; // a work week is 5 weekdays
  var perDayPay = p.per === "day" ? rate : rate * hoursPerWeekday;
  return {
    mode: "hourly",
    weekdays: weekdays,
    worked: worked,
    hoursPerWeekday: hoursPerWeekday,
    totalHours: worked * hoursPerWeekday,
    gross: worked * perDayPay,
    net: worked * perDayPay * (takeHome / 100)
  };
}
