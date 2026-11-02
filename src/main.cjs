const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
  powerMonitor,
  globalShortcut,
  dialog,
  shell,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { Store } = require("./store.cjs");
const {
  dayKey,
  validateConfig,
  barrageFor,
  validateBarrage,
  occurrences,
  dueBetween,
  makeEvent,
  csv,
} = require("./domain.cjs");
const testing = process.env.REMEMBER_TEST === "1";
if (testing && process.env.REMEMBER_TEST_DATA)
  app.setPath("userData", process.env.REMEMBER_TEST_DATA);
else app.setPath("userData", path.join(app.getPath("appData"), "Remember"));
app.setAppUserModelId("local.remember.desktop");
let store,
  mainWindow,
  barrageWindow,
  confirmWindow,
  pinWindow,
  pinExpiry,
  tray,
  active = null,
  queue = [],
  expiry = null,
  quitting = false,
  suspended = false,
  locked = false,
  lastTick = new Date(),
  dailyPromptDate = null,
  shortcutAvailable = false;
const webPreferences = {
  preload: path.join(__dirname, "preload.cjs"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  backgroundThrottling: false,
};
function secure(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
}
function state() {
  const now = new Date();
  const session = store.session;
  const enabled = session.date === dayKey(now) && session.enabled;
  const paused =
    enabled && session.pausedUntil && new Date(session.pausedUntil) > now;
  const today = store
    .list()
    .filter((e) => dayKey(new Date(e.scheduled_at)) === dayKey(now));
  const next = occurrences(store.config, now)
    .filter((x) => x.scheduled > now)
    .map((x) => ({
      id: x.reminder.id,
      title: x.reminder.title,
      category: x.reminder.category,
      time: x.scheduled.toISOString(),
    }));
  return {
    config: store.config,
    session: { ...session, enabled, paused: !!paused },
    events: store.list().slice(0, 1000),
    eventCount: store.events.size,
    next,
    today: {
      shown: today.filter((e) => e.displayed_at).length,
      acknowledged: today.filter((e) => e.status === "acknowledged").length,
    },
    warnings: store.warnings,
    shortcutAvailable,
    dataDirectory: store.directory,
  };
}
function broadcast() {
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send("state-changed", state());
  updateTray();
}
function showMain() {
  if (testing && process.env.REMEMBER_TEST_SILENT === "1") return;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}
function updateTray() {
  if (!tray || !store) return;
  const s = state().session;
  tray.setToolTip(
    `弹幕提醒 · ${s.paused ? "已暂停" : s.enabled ? "今日提醒已开启" : "等待开启"}`,
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开弹幕提醒", click: showMain },
      {
        label: s.enabled ? "今日提醒已开启" : "开启今天的提醒",
        enabled: !s.enabled,
        click: () => setSession("start"),
      },
      {
        label: "暂停 30 分钟",
        enabled: s.enabled,
        click: () => setSession("pause30"),
      },
      {
        label: "暂停 1 小时",
        enabled: s.enabled,
        click: () => setSession("pause60"),
      },
      {
        label: "恢复提醒",
        enabled: s.paused,
        click: () => setSession("resume"),
      },
      {
        label: "今天不再提醒",
        enabled: s.enabled,
        click: () => setSession("stop"),
      },
      { type: "separator" },
      {
        label: "关闭当前提醒",
        enabled: !!active,
        click: () => finish("dismissed", "tray_close"),
      },
      {
        label: "退出软件",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
}
function resetDay(now) {
  const date = dayKey(now);
  if (store.session.date !== date) {
    cancelAll("day_changed");
    store.session = { date, enabled: false, pausedUntil: null };
    store.save();
    broadcast();
  }
  if (
    store.config.setupComplete &&
    !store.session.enabled &&
    store.config.weekdays.includes(now.getDay()) &&
    dailyPromptDate !== date
  ) {
    dailyPromptDate = date;
    showMain();
  }
}
function setSession(action) {
  const now = new Date();
  resetDay(now);
  if (action === "start" || action === "resume") {
    store.session.enabled = true;
    store.session.pausedUntil = null;
    lastTick = now;
  } else if (action === "stop") {
    store.session.enabled = false;
    store.session.pausedUntil = null;
    cancelAll("disabled_today");
  } else if (["pause30", "pause60"].includes(action)) {
    store.session.enabled = true;
    store.session.pausedUntil = new Date(
      now.getTime() + (action === "pause30" ? 30 : 60) * 60000,
    ).toISOString();
    cancelAll("paused");
  } else throw Error("未知的操作。");
  dailyPromptDate = dayKey(now);
  store.save();
  broadcast();
  return state();
}
function persist(event) {
  store.put(event);
  broadcast();
}
function cancelAll(reason) {
  closePin();
  const pending = queue;
  queue = [];
  for (const event of pending)
    persist({
      ...event,
      status: "skipped",
      reason,
      ended_at: new Date().toISOString(),
    });
  if (active) finish("interrupted", reason, false);
}
function closePin() {
  clearTimeout(pinExpiry);
  const win = pinWindow;
  pinWindow = null;
  if (win && !win.isDestroyed()) win.destroy();
}
async function showPin(event) {
  if (!store.config.importantPin.enabled || event.importance !== "important")
    return;
  closePin();
  const work = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint(),
  ).workArea;
  const win = new BrowserWindow({
    width: 340,
    height: 84,
    x: work.x + work.width - 360,
    y: work.y + work.height - 110,
    frame: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    webPreferences,
  });
  pinWindow = win;
  secure(win);
  win.setMenu(null);
  win.setAlwaysOnTop(true, "floating");
  win.setIgnoreMouseEvents(false);
  const seconds = store.config.importantPin.seconds;
  try {
    await win.loadFile(path.join(__dirname, "ui/pin.html"));
    if (win.isDestroyed() || pinWindow !== win) return;
    win.webContents.send("reminder", { ...event, pinSeconds: seconds });
    if (!(testing && process.env.REMEMBER_TEST_SILENT === "1"))
      win.showInactive();
    pinExpiry = setTimeout(() => {
      if (pinWindow === win) closePin();
    }, seconds * 1000);
  } catch {
    if (pinWindow === win) closePin();
  }
}
function finish(status, reason = null, continueQueue = true) {
  if (!active) return;
  clearTimeout(expiry);
  expiry = null;
  const event = active;
  active = null;
  const now = new Date().toISOString();
  event.status = status;
  event.ended_at = now;
  event.reason = reason;
  if (status === "acknowledged") event.acknowledged_at = now;
  if (barrageWindow && !barrageWindow.isDestroyed()) {
    barrageWindow.webContents.send("reminder", null);
    barrageWindow.hide();
  }
  const oldConfirm = confirmWindow;
  confirmWindow = null;
  if (oldConfirm && !oldConfirm.isDestroyed()) {
    oldConfirm.webContents.send("reminder", null);
    oldConfirm.hide();
    setImmediate(() => {
      if (!oldConfirm.isDestroyed()) oldConfirm.destroy();
    });
  }
  persist(event);
  if (status === "acknowledged") void showPin(event);
  if (continueQueue) void showNext();
}
async function showNext() {
  if (active || !queue.length || suspended || locked) return;
  const event = queue.shift();
  active = event;
  const work = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint(),
  ).workArea;
  barrageWindow.setBounds(work);
  const width = Math.min(620, work.width - 24),
    height = Math.min(142, work.height);
  // A fresh, focusable input window avoids stale hit regions after hiding a
  // transparent WS_EX_NOACTIVATE window on Windows. showInactive avoids focus stealing.
  const win = new BrowserWindow({
    width,
    height,
    x: Math.round(work.x + (work.width - width) / 2),
    y: work.y + work.height - height - 18,
    frame: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    webPreferences,
  });
  confirmWindow = win;
  secure(win);
  win.setMenu(null);
  win.setAlwaysOnTop(true, "screen-saver");
  win.setIgnoreMouseEvents(false);
  try {
    await win.loadFile(path.join(__dirname, "ui/overlay.html"), {
      query: { mode: "confirm" },
    });
    if (active !== event || win.isDestroyed()) return;
    event.status = "displayed";
    event.displayed_at = new Date().toISOString();
    event.expires_at = new Date(
      Date.now() + event.confirmation_timeout_seconds * 1000,
    ).toISOString();
    barrageWindow.webContents.send("reminder", event);
    win.webContents.send("reminder", event);
    if (!(testing && process.env.REMEMBER_TEST_SILENT === "1")) {
      barrageWindow.showInactive();
      win.showInactive();
    }
    persist(event);
    expiry = setTimeout(() => {
      if (active?.event_id === event.event_id) finish("timed_out");
    }, event.confirmation_timeout_seconds * 1000);
  } catch (error) {
    if (active === event) {
      store.warnings.push("提醒窗口未能打开：" + error.message);
      finish("interrupted", "window_error");
    }
  }
}
function submit(event) {
  if (!event.barrage) {
    const reminder =
      store.config.reminders.find((r) => r.id === event.reminder_id) || event;
    event.barrage = barrageFor(reminder, store.config.barrage);
  }
  persist(event);
  queue.push(event);
  showNext();
}
function tick() {
  if (!store) return;
  const now = new Date();
  resetDay(now);
  const gap = now - lastTick > 90000;
  const seen = new Set(store.list().map((e) => e.occurrence_key));
  for (const item of dueBetween(store.config, lastTick, now)) {
    if (seen.has(item.key)) continue;
    const event = makeEvent(item);
    let reason = null;
    if (gap || suspended || locked)
      reason = locked ? "screen_locked" : "sleep_or_offline";
    else if (!store.config.setupComplete || !store.session.enabled)
      reason = "not_enabled";
    else if (
      store.session.pausedUntil &&
      item.scheduled < new Date(store.session.pausedUntil)
    )
      reason = "paused";
    if (reason)
      persist({
        ...event,
        status: "skipped",
        reason,
        ended_at: now.toISOString(),
      });
    else submit(event);
  }
  lastTick = now;
  if (store.session.pausedUntil && new Date(store.session.pausedUntil) <= now) {
    store.session.pausedUntil = null;
    store.save();
    broadcast();
  }
}
function listen(channel, fn, overlayAllowed = false) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      event.sender !== mainWindow?.webContents &&
      !(overlayAllowed && event.sender === confirmWindow?.webContents)
    )
      throw Error("窗口未获授权。");
    try {
      return { ok: true, value: await fn(...args) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
}
async function initialize() {
  store = new Store(path.join(app.getPath("userData"), "data"));
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 790,
    minWidth: 840,
    minHeight: 640,
    title: "弹幕提醒",
    backgroundColor: "#f7f8fa",
    icon: path.join(__dirname, "../assets/icon.png"),
    show: false,
    autoHideMenuBar: true,
    webPreferences,
  });
  secure(mainWindow);
  mainWindow.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  const overlayOptions = {
    frame: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences,
  };
  barrageWindow = new BrowserWindow({
    ...overlayOptions,
    width: 800,
    height: 600,
  });
  for (const win of [barrageWindow]) {
    secure(win);
    win.setAlwaysOnTop(true, "screen-saver");
    win.setMenu(null);
  }
  barrageWindow.setIgnoreMouseEvents(true);
  ipcMain.handle("close-pin", (event) => {
    if (event.sender !== pinWindow?.webContents) return { ok: false };
    closePin();
    return { ok: true };
  });
  listen("state", () => state());
  listen("save-config", (config) => {
    const valid = validateConfig(config);
    if (valid.startup !== store.config.startup) {
      if (!app.isPackaged && !testing)
        throw Error("开机启动请在安装版中设置。");
      if (!testing)
        app.setLoginItemSettings({
          openAtLogin: valid.startup,
          path: process.execPath,
          args: ["--autostart"],
        });
    }
    cancelAll("settings_changed");
    store.config = valid;
    store.save();
    lastTick = new Date();
    broadcast();
    return state();
  });
  listen("session", setSession);
  listen("preview", (id, options) => {
    const reminder = store.config.reminders.find((r) => r.id === id);
    if (!reminder) throw Error("提醒不存在。");
    if (active || queue.length) throw Error("请先关闭当前提醒，再预览。");
    const event = makeEvent(
      { reminder, scheduled: new Date(), key: null },
      true,
    );
    event.barrage = barrageFor(
      reminder,
      options ? validateBarrage(options) : store.config.barrage,
    );
    submit(event);
    return true;
  });
  listen(
    "respond",
    (id, action) => {
      if (!active || active.event_id !== id) return false;
      if (!["acknowledged", "dismissed"].includes(action))
        throw Error("无效的回应。");
      finish(action);
      return true;
    },
    true,
  );
  listen("data-folder", async () => {
    const error = await shell.openPath(store.directory);
    if (error) throw Error(error);
    return true;
  });
  listen("export", async (format, from, to) => {
    if (!["json", "csv"].includes(format)) throw Error("导出格式无效。");
    if (
      (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) ||
      (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) ||
      (from && to && from > to)
    )
      throw Error("请选择有效的日期范围。");
    const events = store.list().filter((e) => {
      const d = dayKey(new Date(e.scheduled_at));
      return (!from || d >= from) && (!to || d <= to);
    });
    const result =
      testing && process.env.REMEMBER_TEST_EXPORT
        ? {
            filePath: path.join(
              process.env.REMEMBER_TEST_EXPORT,
              "records." + format,
            ),
          }
        : await dialog.showSaveDialog(mainWindow, {
            title: "导出提醒记录",
            defaultPath: `remember-${dayKey(new Date())}.${format}`,
            filters: [{ name: format.toUpperCase(), extensions: [format] }],
          });
    if (result.canceled || !result.filePath) return null;
    const payload = {
      schema_version: "1.0",
      app_version: app.getVersion(),
      exported_at: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      semantics:
        "acknowledged means noticed, not completed; timestamps are ISO 8601 UTC; skipped means not displayed",
      range: { from: from || null, to: to || null },
      config: store.config,
      events,
    };
    fs.writeFileSync(
      result.filePath,
      format === "json" ? JSON.stringify(payload, null, 2) : csv(events),
      "utf8",
    );
    return { path: result.filePath, count: events.length };
  });
  await Promise.all([
    mainWindow.loadFile(path.join(__dirname, "ui/index.html")),
    barrageWindow.loadFile(path.join(__dirname, "ui/overlay.html"), {
      query: { mode: "barrage" },
    }),
  ]);
  tray = new Tray(
    nativeImage
      .createFromPath(path.join(__dirname, "../assets/icon.png"))
      .resize({ width: 32, height: 32 }),
  );
  tray.on("double-click", showMain);
  tray.on("click", showMain);
  shortcutAvailable = globalShortcut.register(
    "CommandOrControl+Alt+Space",
    () => {
      if (active) finish("dismissed", "shortcut");
    },
  );
  resetDay(new Date());
  broadcast();
  if (
    !process.argv.includes("--autostart") ||
    !store.config.setupComplete ||
    !store.session.enabled
  )
    showMain();
  powerMonitor.on("suspend", () => {
    suspended = true;
    cancelAll("computer_sleep");
  });
  powerMonitor.on("resume", () => {
    suspended = false;
    tick();
    broadcast();
  });
  powerMonitor.on("lock-screen", () => {
    locked = true;
    cancelAll("screen_locked");
  });
  powerMonitor.on("unlock-screen", () => {
    tick();
    locked = false;
    broadcast();
  });
  setInterval(tick, 1000);
  setInterval(broadcast, 30000);
  if (testing)
    globalThis.rememberTest = {
      trigger(id) {
        const reminder = store.config.reminders.find((r) => r.id === id);
        submit(
          makeEvent({
            reminder,
            scheduled: new Date(),
            key: "test:" + Date.now() + ":" + id,
          }),
        );
      },
      getActive: () => active,
      getState: state,
      showMain,
    };
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", showMain);
  app
    .whenReady()
    .then(initialize)
    .catch((error) => {
      dialog.showErrorBox("弹幕提醒启动失败", error.stack || error.message);
      quitting = true;
      app.quit();
    });
  app.on("window-all-closed", () => {});
  app.on("before-quit", () => {
    quitting = true;
    if (store) cancelAll("application_exit");
    globalShortcut.unregisterAll();
  });
}
