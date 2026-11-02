const { randomUUID } = require("node:crypto");
const DEFAULTS = {
  setupComplete: false,
  barrage: { count: 5, rounds: 1, speed: 220, spread: 70 },
  importantPin: { enabled: false, seconds: 60 },
  weekdays: [1, 2, 3, 4, 5],
  periods: [
    { start: "09:30", end: "12:00" },
    { start: "14:00", end: "18:00" },
  ],
  startup: false,
  reminders: [
    {
      id: "water",
      title: "喝口水吧",
      category: "water",
      enabled: true,
      mode: "interval",
      interval: 30,
      timeout: 15,
      importance: "normal",
    },
    {
      id: "stand",
      title: "站起来活动一下",
      category: "stand",
      enabled: true,
      mode: "interval",
      interval: 60,
      timeout: 15,
      importance: "normal",
    },
    {
      id: "clock-in",
      title: "别忘了上班打卡",
      category: "clock",
      enabled: true,
      mode: "fixed",
      time: "09:30",
      timeout: 60,
      importance: "important",
    },
    {
      id: "clock-out",
      title: "别忘了下班打卡",
      category: "clock",
      enabled: true,
      mode: "fixed",
      time: "18:00",
      timeout: 60,
      importance: "important",
    },
  ],
};
function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function minutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function atMinute(date, minute) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minute / 60),
    minute % 60,
    0,
    0,
  );
}
const PRESET_MESSAGES = {
  water: [
    "喝水时间到了",
    "喝一口水",
    "记得喝口水",
    "给自己补点水",
    "水杯就在手边",
    "停一下，喝口水",
    "喝水提醒",
  ],
  stand: [
    "离开椅子，站一站",
    "该起身活动啦",
    "换个姿势吧",
    "起来走两步",
    "起身活动",
    "站起来，伸伸腰",
    "暂时离开屏幕吧",
  ],
};
function validateBarrage(value = DEFAULTS.barrage) {
  if (
    !value ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    value.count > 7
  )
    throw Error("每轮弹幕数量应为 1–7 条。");
  if (![1, 2].includes(value.rounds))
    throw Error("弹幕播放轮数应为 1 或 2 轮。");
  const speed = value.speed ?? DEFAULTS.barrage.speed;
  if (!Number.isInteger(speed) || speed < 100 || speed > 500)
    throw Error("弹幕速度应为 100–500 像素/秒。");
  const spread = value.spread ?? DEFAULTS.barrage.spread;
  if (!Number.isInteger(spread) || spread < 0 || spread > 100)
    throw Error("弹幕分散程度应为 0–100。");
  return { count: value.count, rounds: value.rounds, speed, spread };
}
function barrageFor(reminder, options) {
  return {
    ...validateBarrage(options),
    messages: reminder.messages?.length
      ? [...reminder.messages]
      : PRESET_MESSAGES[reminder.category] || [reminder.title],
  };
}
function validateConfig(input) {
  if (
    !input ||
    !Array.isArray(input.weekdays) ||
    !input.weekdays.length ||
    input.weekdays.some((x) => !Number.isInteger(x) || x < 0 || x > 6)
  )
    throw Error("请至少选择一个工作日。");
  const timeOK = (x) =>
    typeof x === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
  if (
    !Array.isArray(input.periods) ||
    input.periods.length < 1 ||
    input.periods.length > 4
  )
    throw Error("请设置 1–4 段工作时间。");
  const periods = input.periods
    .map((p) => ({ start: p.start, end: p.end }))
    .sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (
      !timeOK(p.start) ||
      !timeOK(p.end) ||
      minutes(p.start) >= minutes(p.end)
    )
      throw Error("每段工作时间的结束必须晚于开始。");
    if (i && periods[i - 1].end >= p.start)
      throw Error("工作时段不能重叠或共用边界。");
  }
  if (!Array.isArray(input.reminders) || input.reminders.length > 40)
    throw Error("最多支持 40 个提醒。");
  const ids = new Set();
  const reminders = input.reminders.map((r) => {
    if (typeof r.id !== "string" || !r.id || r.id.length > 80 || ids.has(r.id))
      throw Error("提醒标识重复或无效。");
    ids.add(r.id);
    if (typeof r.title !== "string" || !r.title.trim() || r.title.length > 60)
      throw Error("提醒内容需要 1–60 个字。");
    if (!["interval", "fixed"].includes(r.mode)) throw Error("提醒方式无效。");
    if (
      r.mode === "interval" &&
      (!Number.isInteger(r.interval) || r.interval < 1 || r.interval > 480)
    )
      throw Error("循环间隔应为 1–480 分钟。");
    if (r.mode === "fixed" && !timeOK(r.time))
      throw Error("请设置有效的提醒时间。");
    if (!Number.isInteger(r.timeout) || r.timeout < 5 || r.timeout > 600)
      throw Error("等待确认应为 5–600 秒。");
    if (
      r.messages != null &&
      (!Array.isArray(r.messages) ||
        r.messages.length > 20 ||
        r.messages.some((s) => typeof s !== "string" || s.length > 60))
    )
      throw Error("弹幕文案最多 20 条，每条不超过 60 字。");
    const messages = [
      ...new Set((r.messages || []).map((s) => s.trim()).filter(Boolean)),
    ];
    return {
      id: r.id,
      title: r.title.trim(),
      category: ["water", "stand", "clock", "custom"].includes(r.category)
        ? r.category
        : "custom",
      enabled: !!r.enabled,
      mode: r.mode,
      ...(r.mode === "interval" ? { interval: r.interval } : { time: r.time }),
      timeout: r.timeout,
      importance: r.importance === "important" ? "important" : "normal",
      messages,
    };
  });
  const pin = input.importantPin ?? DEFAULTS.importantPin;
  if (
    !pin ||
    typeof pin.enabled !== "boolean" ||
    !Number.isInteger(pin.seconds) ||
    pin.seconds < 30 ||
    pin.seconds > 300
  )
    throw Error("重要提醒浮条保留时间应为 30–300 秒。");
  return {
    setupComplete: !!input.setupComplete,
    weekdays: [...new Set(input.weekdays)],
    periods,
    startup: !!input.startup,
    reminders,
    barrage: validateBarrage(input.barrage),
    importantPin: { enabled: pin.enabled, seconds: pin.seconds },
  };
}
function occurrences(config, date) {
  if (!config.weekdays.includes(date.getDay())) return [];
  const result = [];
  for (const reminder of config.reminders.filter((r) => r.enabled)) {
    const times = [];
    if (reminder.mode === "fixed") times.push(minutes(reminder.time));
    else
      for (const p of config.periods)
        for (
          let m = minutes(p.start) + reminder.interval;
          m <= minutes(p.end);
          m += reminder.interval
        )
          times.push(m);
    for (const minute of new Set(times)) {
      const scheduled = atMinute(date, minute);
      result.push({
        key: `${dayKey(date)}:${reminder.id}:${minute}`,
        scheduled,
        reminder,
      });
    }
  }
  return result.sort((a, b) => a.scheduled - b.scheduled);
}
function dueBetween(config, after, now) {
  const result = [];
  // At most two days: a long shutdown never produces a backlog of reminders.
  const start = new Date(Math.max(after.getTime(), now.getTime() - 86400000));
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (day <= now) {
    for (const item of occurrences(config, day))
      if (item.scheduled > after && item.scheduled <= now) result.push(item);
    day.setDate(day.getDate() + 1);
  }
  return result;
}
function makeEvent(item, preview = false) {
  return {
    schema_version: "1.0",
    event_id: randomUUID(),
    occurrence_key: preview ? null : item.key,
    reminder_id: item.reminder.id,
    title: item.reminder.title,
    category: item.reminder.category,
    importance: item.reminder.importance,
    scheduled_at: item.scheduled.toISOString(),
    displayed_at: null,
    confirmation_timeout_seconds: item.reminder.timeout,
    status: "queued",
    acknowledged_at: null,
    ended_at: null,
    reason: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    preview,
  };
}
function csv(events) {
  const columns = [
    "event_id",
    "reminder_id",
    "title",
    "category",
    "importance",
    "scheduled_at",
    "displayed_at",
    "status",
    "acknowledged_at",
    "ended_at",
    "reason",
    "confirmation_timeout_seconds",
    "timezone",
  ];
  const cell = (x) => {
    let s = x == null ? "" : String(x);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      columns.join(","),
      ...events.map((e) => columns.map((k) => cell(e[k])).join(",")),
    ].join("\r\n")
  );
}
module.exports = {
  DEFAULTS,
  PRESET_MESSAGES,
  validateBarrage,
  barrageFor,
  dayKey,
  minutes,
  atMinute,
  validateConfig,
  occurrences,
  dueBetween,
  makeEvent,
  csv,
};
