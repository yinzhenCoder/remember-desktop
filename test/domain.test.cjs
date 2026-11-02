const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  DEFAULTS,
  validateConfig,
  occurrences,
  dueBetween,
  makeEvent,
  csv,
} = require("../src/domain.cjs");
const { Store } = require("../src/store.cjs");
const config = () => structuredClone(DEFAULTS);
const at = (h, m, s = 0) => new Date(2026, 9, 30, h, m, s); // Friday, local time.
const tempRoot = path.resolve(__dirname, "../.cache/test-data");
fs.mkdirSync(tempRoot, { recursive: true });
const tempDirectory = () => fs.mkdtempSync(path.join(tempRoot, "store-"));
test("work intervals reset after lunch, include exact end boundary", () => {
  const water = occurrences(config(), at(0, 0))
    .filter((x) => x.reminder.id === "water")
    .map(
      (x) =>
        `${x.scheduled.getHours()}:${String(x.scheduled.getMinutes()).padStart(2, "0")}`,
    );
  assert.deepEqual(water, [
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
  ]);
});
test("standing intervals are independently anchored to each period", () => {
  const times = occurrences(config(), at(0, 0))
    .filter((x) => x.reminder.id === "stand")
    .map((x) => [x.scheduled.getHours(), x.scheduled.getMinutes()]);
  assert.deepEqual(times, [
    [10, 30],
    [11, 30],
    [15, 0],
    [16, 0],
    [17, 0],
    [18, 0],
  ]);
});
test("weekends have no events, including clock reminders", () =>
  assert.equal(occurrences(config(), new Date(2026, 9, 31)).length, 0));
test("fixed reminders can fire outside interval work periods", () => {
  const c = config();
  c.reminders[2].time = "09:25";
  assert(
    occurrences(c, at(0, 0)).some(
      (x) => x.reminder.id === "clock-in" && x.scheduled.getMinutes() === 25,
    ),
  );
});
test("all reminders due at the same instant survive", () =>
  assert.equal(dueBetween(config(), at(17, 59, 59), at(18, 0, 1)).length, 3));
test("poll boundaries avoid duplicate events", () =>
  assert.equal(dueBetween(config(), at(10, 0), at(10, 0, 20)).length, 0));
test("disabled reminders are not scheduled", () => {
  const c = config();
  c.reminders[0].enabled = false;
  assert(!occurrences(c, at(0, 0)).some((x) => x.reminder.id === "water"));
});
test("invalid overlap, reversed hours and empty weekdays rejected", () => {
  for (const c of [
    { ...config(), periods: [{ start: "12:00", end: "09:00" }] },
    {
      ...config(),
      periods: [
        { start: "09:00", end: "15:00" },
        { start: "14:00", end: "18:00" },
      ],
    },
    { ...config(), weekdays: [] },
  ])
    assert.throws(() => validateConfig(c));
});
test("interval and timeout must be bounded integers", () => {
  for (const field of ["interval", "timeout"])
    for (const value of [0, -1, 0.5, NaN, 9999]) {
      const c = config();
      c.reminders[0][field] = value;
      assert.throws(() => validateConfig(c));
    }
});
test("custom titles are preserved as text and IDs must be unique", () => {
  const c = config();
  c.reminders[0].title = "<script>not executable</script>";
  assert.equal(validateConfig(c).reminders[0].title, c.reminders[0].title);
  c.reminders.push({ ...c.reminders[0] });
  assert.throws(() => validateConfig(c));
});
test("acknowledgement changes no schedule and captures no completion claim", () => {
  const c = config(),
    item = occurrences(c, at(0, 0))[1],
    e = makeEvent(item);
  e.status = "acknowledged";
  e.acknowledged_at = at(10, 0, 8).toISOString();
  assert(!("completed_at" in e));
  assert.equal(
    occurrences(c, at(0, 0))[1].scheduled.getTime(),
    item.scheduled.getTime(),
  );
});
test("append-only journal reloads the latest snapshot, preview is never stored", () => {
  const dir = tempDirectory();
  const store = new Store(dir);
  const item = occurrences(config(), at(0, 0))[0],
    e = makeEvent(item);
  store.put({
    ...e,
    status: "displayed",
    displayed_at: at(9, 30).toISOString(),
  });
  store.put({
    ...e,
    status: "acknowledged",
    acknowledged_at: at(9, 30, 8).toISOString(),
  });
  store.put(makeEvent(item, true));
  store.save();
  const loaded = new Store(dir);
  assert.equal(loaded.events.size, 1);
  assert.equal(loaded.list()[0].status, "acknowledged");
  assert.equal(
    fs.readFileSync(path.join(dir, "events.jsonl"), "utf8").trim().split("\n")
      .length,
    2,
  );
});
test("a crash is recorded as interruption, never user acknowledgement", () => {
  const dir = tempDirectory(),
    s = new Store(dir);
  s.put({
    ...makeEvent(occurrences(config(), at(0, 0))[0]),
    status: "displayed",
    displayed_at: at(9, 30).toISOString(),
  });
  const loaded = new Store(dir);
  assert.equal(loaded.list()[0].status, "interrupted");
  assert.equal(loaded.list()[0].acknowledged_at, null);
});
test("CSV handles quotes and formula-like content", () => {
  const text = csv([{ title: '=SUM(1,2)"' }]);
  assert(text.startsWith("\ufeff"));
  assert(text.includes('"\'=SUM(1,2)"""'));
});
