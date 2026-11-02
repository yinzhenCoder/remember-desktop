<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { useData } from "vitepress";
import BarrageScene from "./BarrageScene.vue";
const { frontmatter } = useData();
const visible = ref(false);
const replayKey = ref(0);
let timer;
const key = "barrage-reminder-intro-seen";
function close() {
  clearTimeout(timer);
  visible.value = false;
  try {
    sessionStorage.setItem(key, "1");
  } catch {}
}
function start() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  clearTimeout(timer);
  replayKey.value++;
  visible.value = true;
  timer = setTimeout(close, 2700);
}
function onKey(event) {
  if (!visible.value) return;
  if (event.key === "Escape") close();
  if (event.key === "Tab") {
    event.preventDefault();
    document.querySelector(".entry-skip")?.focus();
  }
}
onMounted(() => {
  window.addEventListener("barrage-replay-intro", start);
  window.addEventListener("keydown", onKey);
  let seen = false;
  try {
    seen = sessionStorage.getItem(key) === "1";
  } catch {}
  if (frontmatter.value.barrageHome && !seen) start();
});
onUnmounted(() => {
  clearTimeout(timer);
  window.removeEventListener("barrage-replay-intro", start);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <Transition name="entry">
    <div
      v-if="visible"
      :key="replayKey"
      class="entry-screen"
      role="dialog"
      aria-modal="true"
      aria-label="弹幕提醒，三秒入站动画"
    >
      <button class="entry-skip" @click="close">跳过 <span>Esc</span></button>
      <div class="entry-content">
        <p class="entry-index">桌面提醒工具 <span>3 秒</span></p>
        <BarrageScene running />
        <h1>弹幕提醒<span class="entry-square"></span></h1>
        <p>用桌面弹幕提醒你喝水、起身活动和上下班打卡。</p>
      </div>
      <div class="entry-progress" aria-hidden="true"><span></span></div>
    </div>
  </Transition>
</template>
