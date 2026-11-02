const barrageMode =
  new URLSearchParams(location.search).get("mode") === "barrage";
let currentReminder = null,
  clock = null,
  hideTimer = null,
  animations = [],
  generation = 0,
  responding = false;
function clearMotion() {
  generation++;
  animations.forEach((a) => a.cancel());
  animations = [];
  clearInterval(clock);
  clearTimeout(hideTimer);
}
remember.onReminder((value) => {
  clearMotion();
  currentReminder = value;
  responding = false;
  document.getElementById("acknowledge").disabled = false;
  document.getElementById("dismiss").disabled = false;
  if (!value) {
    document.getElementById("barrage").hidden = true;
    document.getElementById("confirmation").hidden = true;
    return;
  }
  if (barrageMode) {
    const root = document.getElementById("barrage");
    root.replaceChildren();
    root.hidden = false;
    const options = value.barrage || {
      count: 5,
      rounds: 1,
      speed: 220,
      messages: [value.title],
    };
    const count = Math.min(7, Math.max(1, options.count)),
      height = window.innerHeight,
      width = window.innerWidth;
    const offset =
      (parseInt(value.event_id?.replaceAll("-", "").slice(0, 8) || "0", 16) ||
        0) % options.messages.length;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const node = document.createElement("div");
      node.className = "bullet " + value.category;
      node.innerHTML = icon(value.category);
      const text = document.createElement("span");
      text.textContent =
        options.messages[(offset + i) % options.messages.length];
      node.append(text);
      node.style.top =
        Math.round(
          count === 1
            ? height * 0.28
            : 40 + i * Math.max(60, (height - 250) / (count - 1)),
        ) + "px";
      node.style.transform = `translate3d(${width + 32}px,0,0)`;
      fragment.append(node);
    }
    root.append(fragment);
    const token = generation;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (token !== generation) return;
        const nodes = [...root.children],
          widths = nodes.map((n) => n.getBoundingClientRect().width);
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
          nodes.forEach((n) => (n.style.transform = "translate3d(40px,0,0)"));
          return;
        }
        const plans = window.reminderMotion({
          screenWidth: width,
          widths,
          speed: options.speed,
          rounds: options.rounds,
          spread: options.spread,
        });
        plans.forEach((plan) => {
          const animation = nodes[plan.index].animate(
            [
              { transform: `translate3d(${width + 32}px,0,0)` },
              { transform: `translate3d(${-widths[plan.index] - 32}px,0,0)` },
            ],
            {
              duration: plan.duration,
              delay: plan.delay,
              easing: "linear",
              fill: "none",
            },
          );
          animations.push(animation);
        });
        const duration = Math.max(...plans.map((p) => p.delay + p.duration));
        hideTimer = setTimeout(() => {
          if (token === generation) {
            root.hidden = true;
            animations.forEach((a) => a.cancel());
            animations = [];
          }
        }, duration + 50);
      }),
    );
  } else {
    document.getElementById("confirmation").hidden = false;
    document.getElementById("symbol").innerHTML = icon(value.category);
    document.getElementById("title").textContent = value.title;
    document.getElementById("title").title = value.title;
    document.getElementById("detail").textContent =
      (value.preview
        ? "预览 · 不写入记录"
        : "提醒时间 " +
          new Date(value.displayed_at).toLocaleTimeString("zh-CN", {
            hour12: false,
          })) + " · 确认仅表示看到了";
    const update = () =>
      (document.getElementById("remaining").textContent =
        `${Math.max(0, Math.ceil((new Date(value.expires_at) - Date.now()) / 1000))} 秒后自动关闭`);
    update();
    clock = setInterval(update, 250);
  }
});
async function respond(action) {
  if (!currentReminder || responding) return;
  const id = currentReminder.event_id;
  responding = true;
  document.getElementById("acknowledge").disabled = true;
  document.getElementById("dismiss").disabled = true;
  try {
    const result = await remember.respond(id, action);
    if (currentReminder?.event_id !== id) return;
    if (result?.ok && result.value) {
      clearMotion();
      currentReminder = null;
      document.getElementById("confirmation").hidden = true;
    } else {
      document.getElementById("detail").textContent =
        result?.error || "提醒状态已变化，请重试关闭。";
    }
  } catch {
    if (currentReminder?.event_id === id)
      document.getElementById("detail").textContent =
        "未能关闭，请重试或使用 Ctrl + Alt + 空格。";
  } finally {
    if (currentReminder?.event_id === id) {
      responding = false;
      document.getElementById("acknowledge").disabled = false;
      document.getElementById("dismiss").disabled = false;
    }
  }
}
document.getElementById("acknowledge").onclick = () => respond("acknowledged");
document.getElementById("dismiss").onclick = () => respond("dismissed");
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") respond("dismissed");
});
