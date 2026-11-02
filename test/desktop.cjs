const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const testRoot = path.resolve(root, ".cache/desktop-test-" + Date.now());
fs.mkdirSync(testRoot, { recursive: true });
const env = {
  ...process.env,
  REMEMBER_TEST: "1",
  REMEMBER_TEST_DATA: path.join(testRoot, "profile"),
  REMEMBER_TEST_EXPORT: testRoot,
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
let application;
async function until(fn, message) {
  for (let i = 0; i < 100; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(message);
}
(async () => {
  application = await electron.launch({ args: [root], env, timeout: 30000 });
  await until(
    () => application.evaluate(() => !!globalThis.rememberTest),
    "app test bridge ready",
  );
  const windows = application.windows();
  const page = windows.find((p) => p.url().endsWith("index.html"));
  assert(page, "main window exists");
  const errors = [];
  for (const win of windows) win.on("pageerror", (e) => errors.push(e.message));
  await page.locator("#save-settings").click();
  await page.locator("#home").waitFor({ state: "visible" });
  assert.equal(
    (await application.evaluate(() => rememberTest.getState())).session.enabled,
    true,
  );
  console.log("PASS onboarding saves settings and starts today");
  await page.locator('[data-tab="reminders"]').click();
  await page.locator('[data-preview="water"]').click();
  await until(
    () => application.evaluate(() => rememberTest.getActive()?.preview),
    "preview opens",
  );
  async function confirmation() {
    await until(
      () => application.windows().some((p) => p.url().includes("mode=confirm")),
      "confirmation window",
    );
    return application
      .windows()
      .filter((p) => p.url().includes("mode=confirm"))
      .at(-1);
  }
  await (await confirmation()).locator("#acknowledge").click();
  assert.equal(
    (await application.evaluate(() => rememberTest.getState())).eventCount,
    0,
  );
  console.log("PASS preview acknowledgement does not enter production logs");
  await application.evaluate(() => rememberTest.trigger("water"));
  await (await confirmation()).locator("#acknowledge").click();
  let state = await application.evaluate(() => rememberTest.getState());
  assert.equal(state.events[0].status, "acknowledged");
  assert(state.events[0].acknowledged_at);
  assert(state.events[0].displayed_at);
  assert(!state.events[0].completed_at);
  console.log("PASS real acknowledgement timestamps, no completion semantics");
  await application.evaluate(() => rememberTest.trigger("stand"));
  await (await confirmation()).locator("#dismiss").click();
  state = await application.evaluate(() => rememberTest.getState());
  assert.equal(state.events[0].status, "dismissed");
  assert.equal(state.events[0].acknowledged_at, null);
  console.log("PASS manual close stays unacknowledged");
  await page.locator('[data-edit="water"]').click();
  await page.locator("#edit-timeout").fill("5");
  await page.locator('#edit-form button[type="submit"]').click();
  await application.evaluate(() => rememberTest.trigger("water"));
  await until(
    () => application.evaluate(() => !rememberTest.getActive()),
    "timeout closes reminder",
  );
  state = await application.evaluate(() => rememberTest.getState());
  assert.equal(state.events[0].status, "timed_out");
  console.log("PASS automatic timeout");
  await application.evaluate(() => {
    rememberTest.trigger("water");
    rememberTest.trigger("clock-out");
  });
  assert.equal(
    (await application.evaluate(() => rememberTest.getActive())).reminder_id,
    "water",
  );
  await (await confirmation()).locator("#acknowledge").click();
  await until(
    () =>
      application.evaluate(
        () => rememberTest.getActive()?.reminder_id === "clock-out",
      ),
    "queued event follows",
  );
  await (await confirmation()).locator("#dismiss").click();
  console.log(
    "PASS simultaneous reminders queue without losing individual responses",
  );
  await page.locator("#pause-day").selectOption("pause30");
  assert(
    (await application.evaluate(() => rememberTest.getState())).session.paused,
  );
  await page.locator("#resume-day").click();
  assert.equal(
    (await application.evaluate(() => rememberTest.getState())).session.paused,
    false,
  );
  console.log("PASS meeting pause and resume");
  await page.locator("#add-reminder").click();
  await page.locator("#edit-name").fill("带电脑回家");
  await page.locator("#edit-mode").selectOption("fixed");
  await page.locator("#edit-time").fill("17:55");
  await page.locator('#edit-form button[type="submit"]').click();
  assert(
    (
      await application.evaluate(() => rememberTest.getState())
    ).config.reminders.some((r) => r.title === "带电脑回家"),
  );
  console.log("PASS custom reminder creation");
  await page.locator('[data-tab="records"]').click();
  await page.locator("#export-json").click();
  await until(
    () => fs.existsSync(path.join(testRoot, "records.json")),
    "JSON export",
  );
  const exported = JSON.parse(
    fs.readFileSync(path.join(testRoot, "records.json"), "utf8"),
  );
  assert.equal(exported.events.length, 5);
  assert.equal(exported.schema_version, "1.0");
  await page.locator("#export-csv").click();
  await until(
    () => fs.existsSync(path.join(testRoot, "records.csv")),
    "CSV export",
  );
  assert(
    fs
      .readFileSync(path.join(testRoot, "records.csv"), "utf8")
      .includes("acknowledged"),
  );
  console.log("PASS JSON and CSV export");
  await page.screenshot({
    path: path.resolve(root, ".cache/remember-records.png"),
  });
  await page.locator('[data-tab="home"]').click();
  await page.screenshot({
    path: path.resolve(root, ".cache/remember-home.png"),
  });
  await page.locator('[data-tab="reminders"]').click();
  await page.locator('[data-preview="water"]').click();
  await until(
    () => application.evaluate(() => !!rememberTest.getActive()),
    "preview for capture",
  );
  await (
    await confirmation()
  ).screenshot({
    path: path.resolve(root, ".cache/remember-confirmation.png"),
  });
  await (await confirmation()).locator("#dismiss").click();
  assert.deepEqual(errors, []);
  await application.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().endsWith("index.html"),
    );
    main.close();
  });
  assert.equal(
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith("index.html"))
        .isVisible(),
    ),
    false,
  );
  console.log("PASS closing the main window keeps background app alive");
  await application.close();
  application = null;
  application = await electron.launch({ args: [root], env, timeout: 30000 });
  await until(
    () => application.evaluate(() => !!globalThis.rememberTest),
    "restart ready",
  );
  const restored = await application.evaluate(() => rememberTest.getState());
  assert.equal(restored.eventCount, 5);
  assert(restored.config.reminders.some((r) => r.title === "带电脑回家"));
  console.log("PASS records and configuration survive restart");
  console.log("DESKTOP TESTS PASSED. Screenshots saved to outputs.");
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (application) await application.close();
  });
