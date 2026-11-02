const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULTS,
  validateConfig,
  validateBarrage,
  barrageFor,
} = require("../src/domain.cjs");
const motion = require("../src/ui/motion.js");
test("existing settings migrate without losing reminder time", () => {
  const c = structuredClone(DEFAULTS);
  delete c.barrage;
  c.reminders[2].time = "09:10";
  const actual = validateConfig(c);
  assert.equal(actual.reminders[2].time, "09:10");
  assert.deepEqual(actual.barrage, {
    count: 5,
    rounds: 1,
    speed: 220,
    spread: 70,
  });
});
test("quantity, rounds and speed are bounded", () => {
  for (const invalid of [
    { count: 0, rounds: 1 },
    { count: 8, rounds: 1 },
    { count: 7, rounds: 3 },
    { count: 7, rounds: 2, speed: 99 },
    { count: 7, rounds: 2, speed: 501 },
  ])
    assert.throws(() => validateBarrage(invalid));
  assert.deepEqual(
    validateBarrage({ count: 7, rounds: 2, speed: 100, spread: 70 }),
    { count: 7, rounds: 2, speed: 100, spread: 70 },
  );
});
test("water and standing presets, custom copy and title fallback", () => {
  assert.equal(
    barrageFor({ category: "water" }, DEFAULTS.barrage).messages.length,
    7,
  );
  assert.equal(
    barrageFor({ category: "stand" }, DEFAULTS.barrage).messages.length,
    7,
  );
  assert.deepEqual(
    barrageFor({ category: "custom", title: "回家" }, DEFAULTS.barrage)
      .messages,
    ["回家"],
  );
  assert.deepEqual(
    barrageFor(
      { category: "water", messages: ["自己的文案"] },
      DEFAULTS.barrage,
    ).messages,
    ["自己的文案"],
  );
});
test("custom messages trim blanks and reject oversized input", () => {
  const c = structuredClone(DEFAULTS);
  c.reminders[0].messages = [" 喝水 ", "", "喝水"];
  assert.deepEqual(validateConfig(c).reminders[0].messages, ["喝水"]);
  c.reminders[0].messages = ["字".repeat(61)];
  assert.throws(() => validateConfig(c));
});
test("every bullet moves at the selected physical speed despite width differences", () => {
  const widths = [180, 300, 600],
    speed = 220;
  const plans = motion({ screenWidth: 1920, widths, speed, rounds: 1 });
  for (const p of plans)
    assert(
      Math.abs((1920 + widths[p.index] + 64) / (p.duration / 1000) - speed) <
        1e-9,
    );
});
test("two rounds of seven generate fourteen passes with non-overlapping rounds", () => {
  const plans = motion({
    screenWidth: 1920,
    widths: Array(7).fill(300),
    speed: 220,
    rounds: 2,
  });
  assert.equal(plans.length, 14);
  const firstEnd = Math.max(
    ...plans.filter((p) => p.round === 0).map((p) => p.delay + p.duration),
  );
  const secondStart = Math.min(
    ...plans.filter((p) => p.round === 1).map((p) => p.delay),
  );
  assert(secondStart > firstEnd);
});
test("slowing down doubles pass duration without increasing distance", () => {
  const p = (speed) =>
    motion({ screenWidth: 1920, widths: [300], speed, rounds: 1 })[0];
  assert.equal(p(100).duration, p(200).duration * 2);
});
test("default spread separates horizontal positions and alternates entry order", () => {
  const plans = motion({
    screenWidth: 1920,
    widths: Array(5).fill(300),
    speed: 220,
    rounds: 1,
  });
  assert(Math.max(...plans.map((p) => p.delay)) >= 3000);
  assert(plans[1].delay > plans[2].delay);
  const grouped = motion({
    screenWidth: 1920,
    widths: Array(5).fill(300),
    speed: 220,
    rounds: 1,
    spread: 0,
  });
  assert(grouped.every((p) => p.delay === 0));
});
test("migration preserves existing speed and number while adding spread and optional pin", () => {
  const c = structuredClone(DEFAULTS);
  c.barrage = { count: 7, rounds: 2, speed: 310 };
  delete c.importantPin;
  const migrated = validateConfig(c);
  assert.deepEqual(migrated.barrage, {
    count: 7,
    rounds: 2,
    speed: 310,
    spread: 70,
  });
  assert.deepEqual(migrated.importantPin, { enabled: false, seconds: 60 });
});
