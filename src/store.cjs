const fs = require("node:fs");
const path = require("node:path");
const { DEFAULTS, validateConfig } = require("./domain.cjs");
class Store {
  constructor(directory) {
    this.directory = directory;
    fs.mkdirSync(directory, { recursive: true });
    this.warnings = [];
    this.settingsFile = path.join(directory, "settings.json");
    this.journalFile = path.join(directory, "events.jsonl");
    this.config = structuredClone(DEFAULTS);
    this.session = { date: null, enabled: false, pausedUntil: null };
    this.events = new Map();
    if (fs.existsSync(this.settingsFile)) {
      try {
        const value = JSON.parse(fs.readFileSync(this.settingsFile, "utf8"));
        this.config = validateConfig(value.config);
        this.session = value.session || this.session;
      } catch {
        const backup = this.settingsFile + ".invalid-" + Date.now();
        fs.copyFileSync(this.settingsFile, backup);
        this.warnings.push("设置文件异常，已备份并恢复默认设置。");
      }
    }
    if (fs.existsSync(this.journalFile)) {
      const contents = fs.readFileSync(this.journalFile, "utf8");
      for (const line of contents.split("\n").filter(Boolean)) {
        try {
          const e = JSON.parse(line);
          if (e.event_id) this.events.set(e.event_id, e);
        } catch {
          this.warnings.push("有一条不完整的记录未载入，原始文件仍保留。");
        }
      }
      if (contents && !contents.endsWith("\n"))
        fs.appendFileSync(this.journalFile, "\n");
    }
    for (const event of this.events.values())
      if (["queued", "displayed"].includes(event.status))
        this.put({
          ...event,
          status: event.displayed_at ? "interrupted" : "skipped",
          reason: "application_restart",
          ended_at: new Date().toISOString(),
        });
  }
  save() {
    const tmp = this.settingsFile + ".tmp";
    fs.writeFileSync(
      tmp,
      JSON.stringify(
        { schema_version: "1.0", config: this.config, session: this.session },
        null,
        2,
      ),
      "utf8",
    );
    fs.renameSync(tmp, this.settingsFile);
  }
  put(event) {
    if (event.preview) return;
    fs.appendFileSync(this.journalFile, JSON.stringify(event) + "\n", "utf8");
    this.events.set(event.event_id, structuredClone(event));
  }
  list() {
    return [...this.events.values()].sort((a, b) =>
      b.scheduled_at.localeCompare(a.scheduled_at),
    );
  }
}
module.exports = { Store };
