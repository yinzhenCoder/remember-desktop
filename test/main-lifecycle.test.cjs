const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const src = path.resolve(__dirname, "../src");
const wait = () => new Promise((r) => setImmediate(r));
async function createApp() {
  const data = path.resolve(
    __dirname,
    "../.cache/lifecycle-" +
      Date.now() +
      "-" +
      Math.random().toString(16).slice(2),
  );
  const handlers = new Map(),
    windows = [],
    timers = [];
  const configuredPaths = new Map();
  class Window extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.destroyed = false;
      this.visible = false;
      this.messages = [];
      this.webContents = new EventEmitter();
      this.webContents.setWindowOpenHandler = () => {};
      this.webContents.send = (channel, value) =>
        this.messages.push({ channel, value: structuredClone(value) });
      windows.push(this);
    }
    async loadFile(file, options) {
      this.file = file;
      this.query = options?.query;
    }
    setBounds(bounds) {
      this.bounds = bounds;
    }
    setAlwaysOnTop() {}
    setMenu() {}
    setIgnoreMouseEvents(value) {
      this.ignore = value;
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
      this.visible = false;
    }
    hide() {
      this.visible = false;
    }
    show() {
      this.visible = true;
    }
    showInactive() {
      this.visible = true;
    }
    isMinimized() {
      return false;
    }
    restore() {}
    focus() {}
  }
  const app = new EventEmitter();
  app.setPath = (name, value) => configuredPaths.set(name, value);
  app.getPath = () => data;
  app.setAppUserModelId = () => {};
  app.requestSingleInstanceLock = () => true;
  app.whenReady = () => Promise.resolve();
  app.getVersion = () => "0.3.0";
  app.isPackaged = true;
  const electron = {
    app,
    BrowserWindow: Window,
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    Tray: class extends EventEmitter {
      setToolTip() {}
      setContextMenu() {}
    },
    Menu: { buildFromTemplate: (x) => x },
    nativeImage: { createFromPath: () => ({ resize: () => ({}) }) },
    screen: {
      getCursorScreenPoint: () => ({ x: 0, y: 0 }),
      getDisplayNearestPoint: () => ({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      }),
    },
    powerMonitor: new EventEmitter(),
    globalShortcut: { register: () => true, unregisterAll: () => {} },
    dialog: {
      showErrorBox: (a, b) => {
        throw Error(a + b);
      },
    },
    shell: {},
  };
  const context = vm.createContext({
    require: (name) =>
      name === "electron"
        ? electron
        : require(name.startsWith(".") ? path.resolve(src, name) : name),
    __dirname: src,
    process: { env: { REMEMBER_TEST: "1" }, argv: [] },
    console,
    structuredClone,
    setImmediate,
    setInterval: () => {},
    setTimeout: (fn, ms) => {
      const token = { fn, ms, cleared: false };
      timers.push(token);
      return token;
    },
    clearTimeout: (token) => {
      if (token) token.cleared = true;
    },
  });
  vm.runInContext(fs.readFileSync(path.join(src, "main.cjs"), "utf8"), context);
  for (let i = 0; i < 20 && !context.rememberTest; i++) await wait();
  assert(context.rememberTest);
  const main = windows.find((w) => w.file?.endsWith("index.html"));
  const invoke = (name, sender, ...args) =>
    handlers.get(name)({ sender: sender.webContents }, ...args);
  const preview = async (id) => {
    const result = await invoke("preview", main, id);
    assert(result.ok);
    await wait();
    return windows.filter((w) => w.query?.mode === "confirm").at(-1);
  };
  return {
    configuredPaths,
    context,
    windows,
    timers,
    main,
    invoke,
    preview,
    active: () => context.rememberTest.getActive(),
  };
}
test("renaming the product preserves the legacy Remember data directory", async () => {
  const app = await createApp();
  assert.equal(path.basename(app.configuredPaths.get("userData")), "Remember");
});
test("repeated ordinary and important previews use fresh clickable windows and acknowledge immediately", async () => {
  const a = await createApp();
  let previous;
  for (const id of ["water", "water", "clock-out", "clock-out", "stand"]) {
    const win = await a.preview(id);
    assert.notEqual(win, previous);
    assert.equal(win.options.focusable, true);
    assert.equal(win.ignore, false);
    assert.equal(win.visible, true);
    const current = a.active();
    assert.equal(current.reminder_id, id);
    const result = await a.invoke(
      "respond",
      win,
      current.event_id,
      "acknowledged",
    );
    assert.equal(result.value, true);
    assert.equal(a.active(), null);
    assert.equal(win.visible, false);
    await wait();
    assert.equal(win.destroyed, true);
    previous = win;
  }
  assert.equal(a.context.rememberTest.getState().eventCount, 0);
});
test("a stale timeout or stale response cannot close the next reminder", async () => {
  const a = await createApp();
  const first = await a.preview("water");
  const firstId = a.active().event_id;
  const oldTimer = a.timers.at(-1);
  await a.invoke("respond", first, firstId, "dismissed");
  const second = await a.preview("clock-out");
  const secondId = a.active().event_id;
  oldTimer.fn();
  assert.equal(a.active().event_id, secondId);
  const result = await a.invoke("respond", second, firstId, "acknowledged");
  assert.equal(result.value, false);
  assert.equal(a.active().event_id, secondId);
  await a.invoke("respond", second, secondId, "acknowledged");
  assert.equal(a.active(), null);
});
test("important pin is optional, separate from acknowledgement, draggable and auto-expiring", async () => {
  const a = await createApp();
  const config = a.context.rememberTest.getState().config;
  config.importantPin = { enabled: true, seconds: 60 };
  await a.invoke("save-config", a.main, config);
  const win = await a.preview("clock-out");
  await a.invoke("respond", win, a.active().event_id, "acknowledged");
  await wait();
  assert.equal(a.active(), null);
  const pin = a.windows.filter((w) => w.file?.endsWith("pin.html")).at(-1);
  assert(pin);
  assert.equal(pin.visible, true);
  assert.equal(pin.ignore, false);
  assert.equal(pin.messages.at(-1).value.status, "acknowledged");
  assert(pin.messages.at(-1).value.acknowledged_at);
  const timer = a.timers.at(-1);
  assert.equal(timer.ms, 60000);
  timer.fn();
  assert.equal(pin.destroyed, true);
  const normal = await a.preview("water");
  await a.invoke("respond", normal, a.active().event_id, "acknowledged");
  await wait();
  assert.equal(a.windows.filter((w) => w.file?.endsWith("pin.html")).length, 1);
});
test("acknowledged important event is recorded once even while its pin remains visible", async () => {
  const a = await createApp();
  const config = a.context.rememberTest.getState().config;
  config.importantPin = { enabled: true, seconds: 60 };
  await a.invoke("save-config", a.main, config);
  a.context.rememberTest.trigger("clock-out");
  await wait();
  const confirm = a.windows.filter((w) => w.query?.mode === "confirm").at(-1);
  const id = a.active().event_id;
  await a.invoke("respond", confirm, id, "acknowledged");
  await wait();
  const state = a.context.rememberTest.getState();
  assert.equal(state.eventCount, 1);
  assert.equal(state.events[0].status, "acknowledged");
  assert(state.events[0].acknowledged_at);
  const pin = a.windows.filter((w) => w.file?.endsWith("pin.html")).at(-1);
  await a.invoke("close-pin", pin);
  assert(pin.destroyed);
  assert.equal(
    a.context.rememberTest.getState().events[0].acknowledged_at,
    state.events[0].acknowledged_at,
  );
});
