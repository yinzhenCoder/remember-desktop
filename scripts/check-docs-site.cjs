const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const output = path.resolve(".cache/site-qa");
fs.mkdirSync(output, { recursive: true });

async function serveBuild(context) {
  const root = path.resolve("docs/.vitepress/dist");
  const mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".woff2": "font/woff2",
  };
  await context.route("https://barrage.local/**", async (route) => {
    let relative = decodeURIComponent(
      new URL(route.request().url()).pathname,
    ).replace(/^\/remember-desktop\/?/, "");
    let file = path.resolve(root, relative || "index.html");
    if (file !== root && !file.startsWith(root + path.sep))
      return route.fulfill({ status: 403, body: "Forbidden" });
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, "index.html");
    if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
    if (!fs.existsSync(file))
      return route.fulfill({ status: 404, body: "Missing" });
    return route.fulfill({
      status: 200,
      contentType: mime[path.extname(file)] || "application/octet-stream",
      body: fs.readFileSync(file),
    });
  });
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: "no-preference",
    });
    await serveBuild(context);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("https://barrage.local/remember-desktop/");
    await page.locator(".entry-screen").waitFor();
    const start = Date.now();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(output, "intro.png") });
    await page
      .locator(".entry-screen")
      .waitFor({ state: "hidden", timeout: 4500 });
    const duration = Date.now() - start;
    assert(duration >= 2300 && duration < 4300, `Intro duration ${duration}ms`);
    await page.screenshot({ path: path.join(output, "desktop.png") });
    assert((await page.locator(".site-hero h1").innerText()).includes("弹幕"));
    await page.locator(".intro-replay").click();
    await page.locator(".entry-screen").waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".entry-screen").waitFor({ state: "hidden" });
    await page.locator(".site-button").click();
    await page.locator(".vp-doc h1").waitFor();
    assert((await page.locator(".vp-doc h1").innerText()).includes("开始使用"));
    await page.locator(".vp-doc img").first().waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".vp-doc img")].every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
    );
    await page.screenshot({
      path: path.join(output, "guide.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      reducedMotion: "reduce",
    });
    await serveBuild(mobileContext);
    const mobile = await mobileContext.newPage();
    await mobile.goto("https://barrage.local/remember-desktop/");
    await mobile.locator(".site-hero").waitFor();
    assert.equal(await mobile.locator(".entry-screen").count(), 0);
    const fits = await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    );
    assert(fits, "Mobile horizontal overflow");
    await mobile.screenshot({
      path: path.join(output, "mobile.png"),
      fullPage: true,
    });
    console.log(
      JSON.stringify({
        introDurationMs: duration,
        checks: [
          "automatic dismissal",
          "replay",
          "escape skip",
          "guide navigation",
          "guide images loaded",
          "no browser errors",
          "reduced motion skips intro",
          "mobile fits",
        ],
        screenshots: output,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
