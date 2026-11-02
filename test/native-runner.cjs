// Embedded in a separate Electron QA app to test on a normal Windows desktop.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const sourceRoot =
  process.env.REMEMBER_QA_SOURCE || path.resolve(__dirname, "..");
const output =
  process.env.REMEMBER_QA_OUTPUT ||
  path.resolve(sourceRoot, ".cache/native-qa");
fs.mkdirSync(output, { recursive: true });
process.env.REMEMBER_TEST = "1";
process.env.REMEMBER_TEST_SILENT = "1";
process.env.REMEMBER_TEST_DATA = path.join(output, "profile");
process.env.REMEMBER_TEST_EXPORT = output;
require(path.join(sourceRoot, "src/main.cjs"));
const checks = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label) {
  for (let i = 0; i < 150; i++) {
    if (await fn()) return;
    await wait(100);
  }
  throw Error("Timeout: " + label);
}
async function run() {
  await until(() => globalThis.rememberTest, "initialization");
  const main = BrowserWindow.getAllWindows().find((w) =>
    w.webContents.getURL().endsWith("index.html"),
  );
  const getConfirm = () =>
    BrowserWindow.getAllWindows()
      .filter((w) => w.webContents.getURL().includes("mode=confirm"))
      .at(-1);
  const js = (code) => main.webContents.executeJavaScript(code);
  const press = async (selector) => {
    await js(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await wait(120);
  };
  const response = async (selector) => {
    await until(() => getConfirm(), "confirmation loaded");
    await getConfirm().webContents.executeJavaScript(
      `document.querySelector(${JSON.stringify(selector)}).click()`,
    );
    await wait(150);
  };
  const state = () => rememberTest.getState();
  await press("#save-settings");
  await until(() => state().session.enabled, "onboarding");
  checks.push("onboarding and daily start");
  await press('[data-tab="reminders"]');
  await press('[data-preview="water"]');
  await until(() => rememberTest.getActive()?.preview, "preview");
  await response("#acknowledge");
  assert.equal(state().eventCount, 0);
  checks.push("preview does not enter logs");
  rememberTest.trigger("water");
  await wait(100);
  await response("#acknowledge");
  assert.equal(state().events[0].status, "acknowledged");
  assert(state().events[0].acknowledged_at);
  assert(state().events[0].displayed_at);
  checks.push("acknowledgement timestamps");
  rememberTest.trigger("stand");
  await wait(100);
  await response("#dismiss");
  assert.equal(state().events[0].status, "dismissed");
  assert.equal(state().events[0].acknowledged_at, null);
  checks.push("dismiss is not acknowledgement");
  await press('[data-edit="water"]');
  await js(`document.querySelector('#edit-timeout').value='5'`);
  await press('#edit-form button[type="submit"]');
  rememberTest.trigger("water");
  await until(() => !rememberTest.getActive(), "5 second timeout");
  assert.equal(state().events[0].status, "timed_out");
  checks.push("timeout");
  rememberTest.trigger("water");
  rememberTest.trigger("clock-out");
  await wait(100);
  await response("#acknowledge");
  assert.equal(rememberTest.getActive().reminder_id, "clock-out");
  await response("#dismiss");
  assert.equal(state().eventCount, 5);
  checks.push("simultaneous reminders queue independently");
  await js(
    `document.querySelector('#pause-day').value='pause30';document.querySelector('#pause-day').dispatchEvent(new Event('change'))`,
  );
  await until(() => state().session.paused, "pause");
  await press("#resume-day");
  assert.equal(state().session.paused, false);
  checks.push("meeting pause and resume");
  await press("#add-reminder");
  await js(
    `document.querySelector('#edit-name').value='带电脑回家';document.querySelector('#edit-mode').value='fixed';document.querySelector('#edit-mode').dispatchEvent(new Event('change'));document.querySelector('#edit-time').value='17:55'`,
  );
  await press('#edit-form button[type="submit"]');
  assert(state().config.reminders.some((r) => r.title === "带电脑回家"));
  checks.push("custom reminder");
  await press('[data-tab="records"]');
  await press("#export-json");
  await until(
    () => fs.existsSync(path.join(output, "records.json")),
    "JSON file",
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(output, "records.json"), "utf8"))
      .events.length,
    5,
  );
  await press("#export-csv");
  await until(
    () => fs.existsSync(path.join(output, "records.csv")),
    "CSV file",
  );
  assert(
    fs
      .readFileSync(path.join(output, "records.csv"), "utf8")
      .includes("acknowledged"),
  );
  checks.push("JSON and CSV exports");
  fs.writeFileSync(
    path.resolve(sourceRoot, ".cache/remember-records.png"),
    (await main.webContents.capturePage()).toPNG(),
  );
  await press('[data-tab="home"]');
  fs.writeFileSync(
    path.resolve(sourceRoot, ".cache/remember-home.png"),
    (await main.webContents.capturePage()).toPNG(),
  );
  await press('[data-tab="reminders"]');
  await press('[data-preview="water"]');
  await wait(200);
  fs.writeFileSync(
    path.resolve(sourceRoot, ".cache/remember-confirmation.png"),
    (await getConfirm().webContents.capturePage()).toPNG(),
  );
  await response("#dismiss");
  main.close();
  assert(!main.isVisible());
  assert(!main.isDestroyed());
  checks.push("close to tray");
  const { Store } = require(path.join(sourceRoot, "src/store.cjs"));
  const restored = new Store(state().dataDirectory);
  assert.equal(restored.events.size, 5);
  assert(restored.config.reminders.some((r) => r.title === "带电脑回家"));
  checks.push("persisted records and settings reload");
  const screens = {
    main: main.getBounds(),
    confirmation: { width: 620, height: 142 },
  };
  fs.writeFileSync(
    path.join(output, "result.json"),
    JSON.stringify({ passed: true, checks, screens }, null, 2),
  );
  app.quit();
}
run().catch((error) => {
  fs.writeFileSync(
    path.join(output, "result.json"),
    JSON.stringify({ passed: false, checks, error: error.stack }, null, 2),
  );
  app.quit();
});
