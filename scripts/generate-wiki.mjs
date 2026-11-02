import fs from "node:fs";
import path from "node:path";
const pages = {
  "guide/getting-started": "Getting-Started",
  "guide/reminders": "Reminders",
  "guide/appearance": "Appearance",
  "guide/data": "Data",
  "guide/faq": "FAQ",
  "development/architecture": "Development",
  "development/publishing": "Publishing",
  roadmap: "Roadmap",
};
fs.mkdirSync("wiki", { recursive: true });
for (const [source, target] of Object.entries(pages))
  fs.writeFileSync(
    path.join("wiki", target + ".md"),
    fs
      .readFileSync(path.join("docs", source + ".md"), "utf8")
      .replaceAll(
        "](/images/",
        "](https://raw.githubusercontent.com/yinzhenCoder/remember-desktop/main/docs/public/images/",
      ),
  );
const links = Object.values(pages)
  .map((name) => `- [${name}](${name})`)
  .join("\n");
fs.writeFileSync(
  "wiki/Home.md",
  "# 弹幕提醒 Wiki\n\n用桌面弹幕提醒你喝水、起身活动和上下班打卡。\n\n" +
    links +
    "\n",
);
fs.writeFileSync("wiki/_Sidebar.md", "[首页](Home)\n\n" + links + "\n");
