const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const root = path.resolve(__dirname, "..");
  fs.mkdirSync(path.join(root, "docs/public"), { recursive: true });
  fs.copyFileSync(
    path.join(root, "assets/logo.svg"),
    path.join(root, "docs/public/logo.svg"),
  );
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1024, height: 1024 },
      deviceScaleFactor: 1,
    });
    await page.goto(pathToFileURL(path.join(root, "assets/logo.svg")).href);
    await page.locator("svg").screenshot({
      path: path.join(root, "assets/icon.png"),
      omitBackground: true,
    });
    console.log(
      "Exported SVG and 1024px PNG logo. Use Pillow to generate the Windows ICO.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
