const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { DEFAULTS, validateConfig } = require("../src/domain.cjs");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "docs/public/images");
const frames = path.join(root, ".cache/docs-frames");
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(frames, { recursive: true });
const base = Date.parse("2026-11-02T10:05:00+08:00");
const config = validateConfig({
  ...structuredClone(DEFAULTS),
  setupComplete: true,
});
config.reminders.forEach((r, i) => {
  r.title = ["喝水", "起身活动", "上班打卡", "下班打卡"][i];
});
const next = [
  ["water", "喝水", "water", "10:30"],
  ["stand", "起身活动", "stand", "10:30"],
  ["water", "喝水", "water", "11:00"],
  ["stand", "起身活动", "stand", "11:30"],
  ["water", "喝水", "water", "12:00"],
  ["clock-out", "下班打卡", "clock", "18:00"],
].map(([id, title, category, time]) => ({
  id,
  title,
  category,
  time: `2026-11-02T${time}:00+08:00`,
}));
const events = [
  ["喝水", "acknowledged", "10:00:00", "10:00:06"],
  ["上班打卡", "acknowledged", "09:30:00", "09:30:08"],
  ["起身活动", "dismissed", "09:00:00", "09:00:03"],
].map(([title, status, planned, ended], i) => ({
  event_id: `example-${i}`,
  title,
  status,
  scheduled_at: `2026-11-02T${planned}+08:00`,
  displayed_at: `2026-11-02T${planned}+08:00`,
  acknowledged_at:
    status === "acknowledged" ? `2026-11-02T${ended}+08:00` : null,
  ended_at: `2026-11-02T${ended}+08:00`,
  reason: null,
}));

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1000, height: 720 },
      deviceScaleFactor: 1,
      timezoneId: "Asia/Shanghai",
      reducedMotion: "no-preference",
    });
    await context.addInitScript(
      ({ config, next, events, base }) => {
        const RealDate = Date;
        window.__media = { now: base, listener: null, stateListener: null };
        window.Date = class extends RealDate {
          constructor(...args) {
            super(...(args.length ? args : [window.__media.now]));
          }
          static now() {
            return window.__media.now;
          }
        };
        const state = {
          config,
          next,
          events,
          eventCount: events.length,
          session: { enabled: true, paused: false },
          today: { shown: 3, acknowledged: 2 },
          warnings: [],
          shortcutAvailable: true,
        };
        const result = (value) => Promise.resolve({ ok: true, value });
        window.remember = {
          state: () => result(state),
          onState: (fn) => {
            window.__media.stateListener = fn;
          },
          onReminder: (fn) => {
            window.__media.listener = fn;
          },
          session: (action) => {
            state.session.enabled = action !== "stop";
            state.session.paused = action.startsWith("pause");
            state.session.pausedUntil = "2026-11-02T10:35:00+08:00";
            return result(state);
          },
          save: (value) => {
            state.config = value;
            return result(state);
          },
          preview: () => result(true),
          respond: () => {
            window.__media.listener?.(null);
            return result(true);
          },
          export: () => result(null),
          dataFolder: () => result(true),
          closePin: () => result(true),
        };
      },
      { config, next, events, base },
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, "src/ui/index.html")).href);
    await page.locator(".agenda-row").first().waitFor();
    await page.screenshot({
      path: path.join(output, "overview.png"),
      fullPage: true,
    });
    await page.locator('[data-tab="reminders"]').click();
    await page.screenshot({ path: path.join(output, "reminders.png") });
    await page.locator('[data-edit="water"]').click();
    await page
      .locator("#edit-dialog")
      .screenshot({ path: path.join(output, "edit-reminder.png") });
    await page.locator("#close-edit").click();
    await page.locator('[data-tab="settings"]').click();
    await page.setViewportSize({ width: 1000, height: 1700 });
    await page
      .locator("#settings .settings-block")
      .first()
      .screenshot({ path: path.join(output, "work-time.png") });
    await page
      .locator("#barrage-settings")
      .screenshot({ path: path.join(output, "barrage-settings.png") });
    await page.setViewportSize({ width: 1000, height: 720 });
    await page.locator('[data-tab="records"]').click();
    await page.screenshot({ path: path.join(output, "records.png") });
    await page.close();

    const indexUrl = pathToFileURL(path.join(root, "src/ui/index.html")).href;
    const overlayUrl = pathToFileURL(
      path.join(root, "src/ui/overlay.html"),
    ).href;
    const demoFile = path.join(root, ".cache/docs-demo.html");
    fs.writeFileSync(
      demoFile,
      `<style>html,body{margin:0;overflow:hidden;background:#f7f8f5}iframe{border:0}#app,#barrage{position:absolute;inset:0;width:100%;height:100%}#confirm{position:absolute;bottom:12px;left:calc(50% - 310px);width:620px;height:142px}</style><iframe id="app" src="${indexUrl}"></iframe><iframe id="barrage" src="${overlayUrl}?mode=barrage"></iframe><iframe id="confirm" src="${overlayUrl}?mode=confirm"></iframe>`,
    );
    const demo = await context.newPage();
    await demo.setViewportSize({ width: 960, height: 600 });
    await demo.goto(pathToFileURL(demoFile).href);
    await demo.frameLocator("#app").locator(".agenda-row").first().waitFor();
    const barrage = demo.frames().find((f) => f.url().endsWith("mode=barrage"));
    const confirm = demo.frames().find((f) => f.url().endsWith("mode=confirm"));
    const reminder = {
      event_id: "example-barrage",
      title: "喝水",
      category: "water",
      importance: "normal",
      preview: true,
      displayed_at: new Date(base).toISOString(),
      expires_at: new Date(base + 15000).toISOString(),
      barrage: {
        count: 5,
        rounds: 1,
        speed: 220,
        spread: 70,
        messages: [
          "喝水时间到了",
          "喝一口水",
          "记得喝水",
          "停一下，喝口水",
          "补充水分",
        ],
      },
    };
    await barrage.evaluate((value) => window.__media.listener(value), reminder);
    await confirm.evaluate((value) => window.__media.listener(value), reminder);
    await demo.waitForTimeout(100);
    await barrage.evaluate(() =>
      document.getAnimations().forEach((a) => a.pause()),
    );
    for (let i = 0; i < 80; i++) {
      if (i < 64) {
        await barrage.evaluate(
          (time) =>
            document.getAnimations().forEach((a) => {
              a.currentTime = time;
            }),
          i * 100,
        );
        await confirm.evaluate((seconds) => {
          document.getElementById("remaining").textContent =
            `${15 - Math.floor(seconds)} 秒后自动关闭`;
        }, i / 10);
      } else if (i === 64) {
        await confirm.locator("#acknowledge").click();
        await barrage.evaluate(() => window.__media.listener(null));
      }
      await demo.screenshot({
        path: path.join(frames, `${String(i).padStart(3, "0")}.png`),
      });
    }
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      "Captured 6 interface screenshots and 80 demonstration frames. Demo data only.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
