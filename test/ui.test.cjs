const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { DEFAULTS, validateConfig } = require("../src/domain.cjs");
const ui = path.resolve(__dirname, "../src/ui");
const tick = () => new Promise((r) => setTimeout(r, 30));
async function setup(t) {
  const state = {
    config: validateConfig({
      ...structuredClone(DEFAULTS),
      setupComplete: true,
    }),
    session: { enabled: false, paused: false },
    next: [
      {
        id: "water",
        category: "water",
        title: "喝口水吧",
        time: new Date().toISOString(),
      },
    ],
    today: { shown: 0, acknowledged: 0 },
    events: [],
    eventCount: 0,
    warnings: [],
    shortcutAvailable: true,
  };
  const calls = [];
  const dom = new JSDOM(fs.readFileSync(path.join(ui, "index.html"), "utf8"), {
    runScripts: "outside-only",
    url: "file:///index.html",
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.structuredClone = structuredClone;
  w.remember = {
    state: async () => ({ ok: true, value: state }),
    onState: () => {},
    session: async (action) => {
      state.session = {
        enabled: action !== "stop",
        paused: action === "pause30",
        pausedUntil: new Date().toISOString(),
      };
      return { ok: true, value: state };
    },
    save: async (config) => {
      state.config = validateConfig(config);
      return { ok: true, value: state };
    },
    preview: async (id, options) => {
      calls.push({ id, options });
      return { ok: true, value: true };
    },
  };
  for (const file of ["icons.js", "app.js"])
    w.eval(fs.readFileSync(path.join(ui, file), "utf8"));
  await tick();
  return {
    w,
    state,
    calls,
    click: (selector) => w.document.querySelector(selector).click(),
    get: (id) => w.document.getElementById(id),
  };
}
test("home shows agenda even before enabling, exposes start/pause/resume", async (t) => {
  const s = await setup(t);
  assert.equal(s.get("home").hidden, false);
  assert.equal(s.get("reminders").hidden, true);
  assert(s.get("next-list").textContent.includes("待开启"));
  s.click("#start-day");
  await tick();
  assert.equal(s.get("pause-quick").hidden, false);
  s.click("#pause-quick");
  await tick();
  assert.equal(s.get("resume-day").hidden, false);
  s.click("#resume-day");
  await tick();
  assert.equal(s.state.session.paused, false);
});
test("barrage settings preview and save all three global preferences", async (t) => {
  const s = await setup(t);
  s.click('[data-tab="settings"]');
  s.get("barrage-count").value = "7";
  s.get("barrage-rounds").value = "2";
  s.get("barrage-speed").value = "100";
  s.get("barrage-speed").dispatchEvent(new s.w.Event("input"));
  assert.equal(s.get("speed-value").textContent, "低速");
  s.click("#preview-barrage");
  await tick();
  assert.deepEqual(
    { ...s.calls[0].options },
    { count: 7, rounds: 2, speed: 100, spread: 70 },
  );
  s.get("settings-form").dispatchEvent(
    new s.w.Event("submit", { cancelable: true }),
  );
  await tick();
  assert.deepEqual(s.state.config.barrage, {
    count: 7,
    rounds: 2,
    speed: 100,
    spread: 70,
  });
});
test("custom reminder text is saved as separate messages and safely rendered", async (t) => {
  const s = await setup(t);
  s.get("edit-dialog").showModal = () => {};
  s.get("edit-dialog").close = () => {};
  s.click("#manage-reminders");
  s.click("#add-reminder");
  s.get("edit-name").value = "<img src=x onerror=alert(1)>";
  s.get("edit-messages").value = "带电脑\n拿钥匙";
  s.get("edit-form").dispatchEvent(
    new s.w.Event("submit", { cancelable: true }),
  );
  await tick();
  const custom = s.state.config.reminders.at(-1);
  assert.deepEqual(custom.messages, ["带电脑", "拿钥匙"]);
  assert.equal(s.get("reminder-cards").querySelectorAll("img").length, 0);
});
test("overlay creates seven linear passes per round and cancels every animation on close", async (t) => {
  const dom = new JSDOM(
    fs.readFileSync(path.join(ui, "overlay.html"), "utf8"),
    {
      runScripts: "outside-only",
      url: "file:///overlay.html?mode=barrage",
      pretendToBeVisual: true,
    },
  );
  t.after(() => dom.window.close());
  const w = dom.window;
  let listener;
  const runs = [];
  w.remember = { onReminder: (fn) => (listener = fn) };
  w.matchMedia = () => ({ matches: false });
  w.Element.prototype.getBoundingClientRect = () => ({ width: 300 });
  w.Element.prototype.animate = function (frames, options) {
    const item = {
      frames,
      options,
      canceled: false,
      cancel() {
        this.canceled = true;
      },
    };
    runs.push(item);
    return item;
  };
  for (const file of ["icons.js", "motion.js", "overlay.js"])
    w.eval(fs.readFileSync(path.join(ui, file), "utf8"));
  listener({
    event_id: "abcd",
    title: "喝水",
    category: "water",
    barrage: {
      count: 7,
      rounds: 2,
      speed: 100,
      messages: ["喝水", "拿起水杯"],
    },
  });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(w.document.querySelectorAll(".bullet").length, 7);
  assert.equal(runs.length, 14);
  assert(runs.every((r) => r.options.easing === "linear"));
  listener(null);
  assert(runs.every((r) => r.canceled));
  assert(w.document.getElementById("barrage").hidden);
});
test("confirmation clicks after a second preview and important preview carry the current ID", async (t) => {
  const dom = new JSDOM(
    fs.readFileSync(path.join(ui, "overlay.html"), "utf8"),
    { runScripts: "outside-only", url: "file:///overlay.html?mode=confirm" },
  );
  t.after(() => dom.window.close());
  const w = dom.window;
  let listener;
  const responses = [];
  w.remember = {
    onReminder: (fn) => (listener = fn),
    respond: async (id, action) => {
      responses.push({ id, action });
      return { ok: true, value: true };
    },
  };
  for (const file of ["icons.js", "overlay.js"])
    w.eval(fs.readFileSync(path.join(ui, file), "utf8"));
  for (const id of ["first", "second", "important"]) {
    listener({
      event_id: id,
      title: id,
      category: "water",
      importance: id === "important" ? "important" : "normal",
      displayed_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15000).toISOString(),
    });
    w.document.getElementById("acknowledge").click();
    await tick();
    assert(w.document.getElementById("confirmation").hidden);
    listener(null);
  }
  assert.deepEqual(responses, [
    { id: "first", action: "acknowledged" },
    { id: "second", action: "acknowledged" },
    { id: "important", action: "acknowledged" },
  ]);
});
test("failed confirmation re-enables the button for retry instead of trapping the reminder", async (t) => {
  const dom = new JSDOM(
    fs.readFileSync(path.join(ui, "overlay.html"), "utf8"),
    { runScripts: "outside-only", url: "file:///overlay.html?mode=confirm" },
  );
  t.after(() => dom.window.close());
  const w = dom.window;
  let listener;
  w.remember = {
    onReminder: (fn) => (listener = fn),
    respond: async () => ({ ok: false, error: "temporarily unavailable" }),
  };
  for (const file of ["icons.js", "overlay.js"])
    w.eval(fs.readFileSync(path.join(ui, file), "utf8"));
  listener({
    event_id: "retry",
    title: "retry",
    category: "water",
    expires_at: new Date(Date.now() + 15000).toISOString(),
  });
  w.document.getElementById("acknowledge").click();
  await tick();
  assert.equal(w.document.getElementById("acknowledge").disabled, false);
  assert.equal(w.document.getElementById("confirmation").hidden, false);
});
test("spread and optional important-pin settings are saved independently", async (t) => {
  const s = await setup(t);
  s.click('[data-tab="settings"]');
  s.get("barrage-spread").value = "100";
  s.get("important-keep").checked = true;
  s.get("important-seconds").value = "120";
  s.get("settings-form").dispatchEvent(
    new s.w.Event("submit", { cancelable: true }),
  );
  await tick();
  assert.equal(s.state.config.barrage.spread, 100);
  assert.deepEqual(s.state.config.importantPin, {
    enabled: true,
    seconds: 120,
  });
});
