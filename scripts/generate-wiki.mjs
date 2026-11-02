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
    fs.readFileSync(path.join("docs", source + ".md"), "utf8"),
  );
const links = Object.values(pages)
  .map((name) => `- [${name}](${name})`)
  .join("\n");
fs.writeFileSync(
  "wiki/Home.md",
  "# 记得一下 Wiki\n\nWindows 桌面提醒工具。\n\n" + links + "\n",
);
fs.writeFileSync("wiki/_Sidebar.md", "[首页](Home)\n\n" + links + "\n");
