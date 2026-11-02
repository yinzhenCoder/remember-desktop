const $ = (id) => document.getElementById(id);
let current,
  editing = null,
  loadedSettings = false,
  toastTimer;
const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const time = (value) =>
  value ? new Date(value).toLocaleTimeString("zh-CN", { hour12: false }) : "—";
const date = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const statusNames = {
  queued: "等待展示",
  displayed: "等待确认",
  acknowledged: "已确认看到",
  dismissed: "主动关闭",
  timed_out: "超时未确认",
  skipped: "未展示",
  interrupted: "展示中断",
};
const reasonNames = {
  paused: "会议 / 暂停",
  not_enabled: "当天尚未开启",
  disabled_today: "当天已关闭",
  screen_locked: "电脑已锁定",
  sleep_or_offline: "休眠或运行中断",
  computer_sleep: "电脑休眠",
  settings_changed: "设置已修改",
  application_restart: "软件重新启动",
  application_exit: "软件已退出",
  day_changed: "进入新的一天",
  tray_close: "托盘关闭",
  shortcut: "快捷键关闭",
};
function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => ($("toast").hidden = true), 5000);
}
async function call(promise) {
  const response = await promise;
  if (!response.ok) throw Error(response.error);
  return response.value;
}
async function action(fn) {
  try {
    await fn();
  } catch (error) {
    toast(error.message);
  }
}
function switchTab(tab) {
  document.querySelectorAll(".page").forEach((x) => (x.hidden = x.id !== tab));
  document
    .querySelectorAll("[data-tab]")
    .forEach((x) => x.classList.toggle("selected", x.dataset.tab === tab));
  $("page-title").textContent = {
    home: "今天的提醒",
    reminders: "提醒管理",
    records: "提醒记录",
    settings: current?.config.setupComplete ? "设置" : "先设置工作时间",
  }[tab];
  if (tab === "settings" && !loadedSettings) populateSettings();
}
function render(value) {
  current = value;
  $("today-date").textContent = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const { session, config } = value;
  $("status-pill").textContent = session.paused
    ? "会议 / 已暂停"
    : session.enabled
      ? "● 今日已开启"
      : "今日未开启";
  $("status-pill").classList.toggle(
    "running",
    session.enabled && !session.paused,
  );
  $("start-day").hidden = session.enabled;
  $("resume-day").hidden = !session.paused;
  $("pause-day").hidden = !session.enabled;
  $("pause-quick").hidden = !session.enabled || session.paused;
  $("session-title").textContent = session.paused
    ? "提醒已暂停"
    : session.enabled
      ? "今天的提醒已开启"
      : "今日提醒未开启";
  $("session-description").textContent = session.paused
    ? `暂停至 ${time(session.pausedUntil)}，随后自动恢复。`
    : session.enabled
      ? value.next.length
        ? `下一条 ${time(value.next[0].time).slice(0, 5)} · ${value.next[0].title}`
        : "今天暂无后续提醒。"
      : "在设定时间显示桌面提醒。";
  $("start-day").textContent = config.setupComplete
    ? "开启提醒"
    : "设置并开启提醒";
  $("work-hours").textContent = config.periods
    .map((p) => p.start + " – " + p.end)
    .join("　 /　 ");
  $("upcoming-count").textContent = value.next.length;
  $("agenda-caption").textContent = session.paused
    ? "当前暂停中，恢复后按后续时间提醒。"
    : !session.enabled
      ? "今日计划如下，开启后生效。"
      : "按时间排列，午休自动停止循环提醒。";
  $("shortcut-note").textContent = value.shortcutAvailable
    ? " Ctrl + Alt + 空格可立即关闭当前提醒。"
    : " 可通过托盘菜单关闭当前提醒。";
  $("warning").hidden = !value.warnings.length;
  $("warning").textContent = [...new Set(value.warnings)].join(" ");
  $("reminder-cards").innerHTML = config.reminders
    .map(
      (r) =>
        `<article class="reminder-card"><div class="card-top"><span class="reminder-icon ${r.category}">${icon(r.category)}</span><input class="switch" type="checkbox" aria-label="启用${escapeHTML(r.title)}" data-toggle="${escapeHTML(r.id)}" ${r.enabled ? "checked" : ""}></div><h3>${escapeHTML(r.title)}</h3><div class="card-timing">${r.mode === "interval" ? `每 ${r.interval} 分钟 · 工作时段内` : `${r.time} · 工作日`}</div><div class="card-footer"><span>${r.importance === "important" ? "重要 · " : ""}等待确认 ${r.timeout} 秒</span><div><button data-preview="${escapeHTML(r.id)}">预览</button> <button data-edit="${escapeHTML(r.id)}">编辑</button></div></div></article>`,
    )
    .join("");
  $("next-list").innerHTML = value.next.length
    ? value.next
        .map(
          (n, i) =>
            `<div class="agenda-row ${i === 0 ? "first" : ""}"><time>${time(n.time).slice(0, 5)}</time><span class="reminder-icon ${n.category}">${icon(n.category)}</span><span class="agenda-title">${escapeHTML(n.title)}</span><span class="agenda-state">${!session.enabled ? "待开启" : session.paused ? "暂停中" : i === 0 ? "下一条" : "待提醒"}</span></div>`,
        )
        .join("")
    : '<div class="agenda-empty">今天暂无后续提醒。<p>可以在「提醒管理」中调整时间或添加事项。</p></div>';
  renderRecords();
}
function renderRecords() {
  const from = $("date-from").value,
    to = $("date-to").value;
  const records = current.events.filter((e) => {
    const d = date(e.scheduled_at);
    return (!from || d >= from) && (!to || d <= to);
  });
  $("record-rows").innerHTML = records.length
    ? records
        .map(
          (e) =>
            `<tr><td>${escapeHTML(e.title)}<small>${date(e.scheduled_at)} ${time(e.scheduled_at)}</small></td><td>${time(e.displayed_at)}</td><td><span class="badge ${e.status}">${statusNames[e.status] || escapeHTML(e.status)}</span>${e.reason ? `<small>${escapeHTML(reasonNames[e.reason] || e.reason)}</small>` : ""}</td><td>${time(e.acknowledged_at || e.ended_at)}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="4"><div class="empty">这段时间还没有提醒记录。预览不会写入正式记录。</div></td></tr>';
  $("record-count").textContent =
    `当前显示 ${records.length} 条 · 页面最多显示最近 1000 条；导出包含所选日期内的全部记录（共保存 ${current.eventCount} 条）。`;
}
function addPeriod(start = "14:00", end = "18:00") {
  if ($("periods").children.length >= 4) return toast("最多设置四段工作时间。");
  const row = document.createElement("div");
  row.className = "period-row";
  row.innerHTML = `<input type="time" value="${start}" aria-label="时段开始" required><span>至</span><input type="time" value="${end}" aria-label="时段结束" required><button type="button" class="subtle" aria-label="删除时段">×</button>`;
  row.querySelector("button").onclick = () => {
    if ($("periods").children.length > 1) row.remove();
    else toast("至少保留一段工作时间。");
  };
  $("periods").append(row);
}
function populateSettings() {
  if (!current) return;
  $("weekdays").innerHTML = ["一", "二", "三", "四", "五", "六", "日"]
    .map(
      (label, i) =>
        `<label class="weekday"><input type="checkbox" value="${(i + 1) % 7}" ${current.config.weekdays.includes((i + 1) % 7) ? "checked" : ""}>周${label}</label>`,
    )
    .join("");
  $("periods").innerHTML = "";
  current.config.periods.forEach((p) => addPeriod(p.start, p.end));
  $("startup").checked = current.config.startup;
  $("barrage-count").value = current.config.barrage.count;
  $("barrage-rounds").value = current.config.barrage.rounds;
  $("barrage-speed").value = current.config.barrage.speed;
  $("barrage-spread").value = current.config.barrage.spread;
  updateSpeed();
  updateSpread();
  $("important-keep").checked = current.config.importantPin.enabled;
  $("important-seconds").value = current.config.importantPin.seconds;
  $("pin-settings").hidden = !current.config.setupComplete;
  $("barrage-settings").hidden = !current.config.setupComplete;
  $("save-settings").textContent = current.config.setupComplete
    ? "保存设置"
    : "保存并开启今天的提醒";
  loadedSettings = true;
}
function openEdit(id) {
  editing = id
    ? current.config.reminders.find((r) => r.id === id)
    : {
        id: crypto.randomUUID(),
        category: "custom",
        enabled: true,
        mode: "interval",
        interval: 30,
        time: "09:30",
        timeout: 15,
        importance: "normal",
        title: "",
      };
  $("edit-title").textContent = id ? "编辑提醒" : "添加自定义提醒";
  $("edit-name").value = editing.title;
  $("edit-mode").value = editing.mode;
  $("edit-interval").value = editing.interval || 30;
  $("edit-time").value = editing.time || "09:30";
  $("edit-importance").value = editing.importance;
  $("edit-timeout").value = editing.timeout;
  $("delete-reminder").hidden = !id || editing.category !== "custom";
  updateMode();
  $("edit-dialog").showModal();
  $("edit-messages").value = (editing.messages || []).join("\n");
  $("messages-hint").textContent = ["water", "stand"].includes(editing.category)
    ? "留空使用内置文案；填写后使用你自己的文案。"
    : "留空使用提醒名称。每条最多 60 字，最多 20 条。";
  $("edit-messages").placeholder =
    editing.category === "water"
      ? "喝水时间到了\n喝一口水\n记得喝口水"
      : editing.category === "stand"
        ? "离开椅子，站一站\n该起身活动啦\n起身活动"
        : "例如：\n别忘了带电脑\n检查一下随身物品";
}
function updateMode() {
  const interval = $("edit-mode").value === "interval";
  $("interval-label").hidden = !interval;
  $("time-label").hidden = interval;
  $("edit-interval").required = interval;
  $("edit-time").required = !interval;
}
document
  .querySelectorAll("[data-icon]")
  .forEach((x) => (x.innerHTML = icon(x.dataset.icon)));
document
  .querySelectorAll("[data-tab]")
  .forEach((button) =>
    button.addEventListener("click", () => switchTab(button.dataset.tab)),
  );
$("start-day").onclick = () =>
  action(async () => {
    if (!current.config.setupComplete) {
      switchTab("settings");
      return;
    }
    render(await call(remember.session("start")));
    toast("今天的提醒已开启。");
  });
$("resume-day").onclick = () =>
  action(async () => render(await call(remember.session("resume"))));
$("pause-quick").onclick = () =>
  action(async () => render(await call(remember.session("pause30"))));
$("manage-reminders").onclick = () => switchTab("reminders");
function updateSpeed() {
  const speed = Number($("barrage-speed").value);
  $("speed-value").textContent =
    speed <= 160
      ? "低速"
      : speed <= 240
        ? "慢速"
        : speed <= 340
          ? "适中"
          : "快速";
  $("barrage-speed").setAttribute(
    "aria-valuetext",
    $("speed-value").textContent,
  );
}
$("barrage-speed").oninput = updateSpeed;
function updateSpread() {
  const spread = Number($("barrage-spread").value);
  $("spread-value").textContent =
    spread < 30 ? "较集中" : spread < 60 ? "适中" : "较分散";
  $("barrage-spread").setAttribute(
    "aria-valuetext",
    $("spread-value").textContent,
  );
}
$("barrage-spread").oninput = updateSpread;
$("preview-barrage").onclick = () =>
  action(async () => {
    await call(
      remember.preview("water", {
        count: Number($("barrage-count").value),
        rounds: Number($("barrage-rounds").value),
        speed: Number($("barrage-speed").value),
        spread: Number($("barrage-spread").value),
      }),
    );
    toast("按当前数量和轮数预览，不写入记录。");
  });
$("pause-day").onchange = () =>
  action(async () => {
    const selected = $("pause-day").value;
    $("pause-day").value = "";
    if (selected) render(await call(remember.session(selected)));
  });
$("reminder-cards").addEventListener("click", (event) => {
  const preview = event.target.closest("[data-preview]"),
    edit = event.target.closest("[data-edit]");
  if (preview)
    action(async () => {
      await call(remember.preview(preview.dataset.preview));
      toast("预览提醒已显示，预览不写入记录。");
    });
  if (edit) openEdit(edit.dataset.edit);
});
$("reminder-cards").addEventListener("change", (event) => {
  if (!event.target.dataset.toggle) return;
  const target = event.target;
  action(async () => {
    const config = structuredClone(current.config);
    config.reminders.find((r) => r.id === target.dataset.toggle).enabled =
      target.checked;
    try {
      render(await call(remember.save(config)));
    } catch (e) {
      target.checked = !target.checked;
      throw e;
    }
  });
});
$("add-reminder").onclick = () => openEdit();
$("close-edit").onclick = () => $("edit-dialog").close();
$("edit-mode").onchange = updateMode;
$("edit-importance").onchange = () =>
  ($("edit-timeout").value =
    $("edit-importance").value === "important" ? 60 : 15);
$("edit-form").onsubmit = (event) => {
  event.preventDefault();
  action(async () => {
    const config = structuredClone(current.config);
    const updated = {
      ...editing,
      title: $("edit-name").value,
      mode: $("edit-mode").value,
      interval: Number($("edit-interval").value),
      time: $("edit-time").value,
      importance: $("edit-importance").value,
      timeout: Number($("edit-timeout").value),
      messages: $("edit-messages")
        .value.split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const i = config.reminders.findIndex((r) => r.id === updated.id);
    if (i < 0) config.reminders.push(updated);
    else config.reminders[i] = updated;
    render(await call(remember.save(config)));
    $("edit-dialog").close();
    toast("提醒已保存。");
  });
};
$("delete-reminder").onclick = () =>
  action(async () => {
    const config = structuredClone(current.config);
    config.reminders = config.reminders.filter((r) => r.id !== editing.id);
    render(await call(remember.save(config)));
    $("edit-dialog").close();
    toast("提醒已删除，历史记录保留。");
  });
$("add-period").onclick = () => addPeriod();
$("settings-form").onsubmit = (event) => {
  event.preventDefault();
  action(async () => {
    const first = !current.config.setupComplete;
    const config = structuredClone(current.config);
    config.setupComplete = true;
    config.weekdays = [...$("weekdays").querySelectorAll("input:checked")].map(
      (x) => Number(x.value),
    );
    config.periods = [...$("periods").children].map((row) => {
      const inputs = row.querySelectorAll("input");
      return { start: inputs[0].value, end: inputs[1].value };
    });
    if (first) {
      const sorted = [...config.periods].sort((a, b) =>
        a.start.localeCompare(b.start),
      );
      config.reminders.find((r) => r.id === "clock-in").time = sorted[0].start;
      config.reminders.find((r) => r.id === "clock-out").time =
        sorted.at(-1).end;
    }
    config.startup = $("startup").checked;
    config.importantPin = {
      enabled: $("important-keep").checked,
      seconds: Number($("important-seconds").value),
    };
    config.barrage = {
      count: Number($("barrage-count").value),
      rounds: Number($("barrage-rounds").value),
      speed: Number($("barrage-speed").value),
      spread: Number($("barrage-spread").value),
    };
    render(await call(remember.save(config)));
    loadedSettings = false;
    populateSettings();
    if (first) {
      render(await call(remember.session("start")));
      switchTab("home");
    }
    toast(first ? "设置完成，今天的提醒已开启。" : "设置已保存。");
  });
};
$("open-data").onclick = () => action(() => call(remember.dataFolder()));
["date-from", "date-to"].forEach((id) => ($(id).onchange = renderRecords));
for (const format of ["json", "csv"])
  $("export-" + format).onclick = () =>
    action(async () => {
      const result = await call(
        remember.export(format, $("date-from").value, $("date-to").value),
      );
      if (result) toast(`已导出 ${result.count} 条记录：${result.path}`);
    });
remember.onState(render);
action(async () => {
  render(await call(remember.state()));
  if (!current.config.setupComplete) switchTab("settings");
});
