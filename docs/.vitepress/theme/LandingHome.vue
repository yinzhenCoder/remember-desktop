<script setup>
import { withBase } from "vitepress";
import BarrageScene from "./BarrageScene.vue";
function replay() {
  window.dispatchEvent(new Event("barrage-replay-intro"));
}
</script>

<template>
  <div class="barrage-home">
    <section class="site-hero">
      <div class="site-hero-copy">
        <p class="section-index">Windows 桌面工具 / 开源</p>
        <h1>弹幕<br />提醒<span class="hero-period">.</span></h1>
        <p class="hero-description">
          用桌面弹幕提醒你喝水、起身活动和上下班打卡。
        </p>
        <div class="hero-actions">
          <a
            class="site-button"
            href="https://github.com/yinzhenCoder/remember-desktop/releases/latest/download/BarrageReminder-Windows-x64.zip"
            >下载 Windows 版 <span>↓</span></a
          >
          <a class="site-link" :href="withBase('/guide/getting-started')"
            >使用说明 ↗</a
          >
        </div>
        <p class="hero-footnote">本地记录 · 可暂停 · MIT 开源</p>
      </div>
      <div class="hero-art">
        <BarrageScene /><button class="intro-replay" @click="replay">
          重播 3 秒入站动画 ↺
        </button>
      </div>
    </section>
    <section id="demo" class="site-section">
      <div class="site-section-title">
        <span class="section-number">01</span>
        <div>
          <h2>到点出现，看到后确认。</h2>
          <p>弹幕从屏幕滑过，底部确认按钮固定不动。点击「知道了」后收起。</p>
        </div>
      </div>
      <img
        :src="withBase('/images/reminder-demo.gif')"
        alt="喝水弹幕出现，点击底部知道了后关闭的操作动图"
        width="960"
        height="600"
        loading="lazy"
      />
      <p class="image-caption">
        使用实际前端界面与示例数据演示；确认表示看到提醒，不表示事项已完成。
      </p>
    </section>
    <section class="site-section">
      <div class="site-section-title">
        <span class="section-number">02</span>
        <div>
          <h2>打开后，先看今天的安排。</h2>
          <p>首页提供开启、暂停和今日待提醒列表。</p>
        </div>
      </div>
      <img
        :src="withBase('/images/overview.png')"
        alt="弹幕提醒首页，包含开启状态、暂停按钮和待提醒列表"
        width="1000"
        height="720"
        loading="lazy"
      />
    </section>
    <section class="site-section site-guide-links">
      <div>
        <span class="section-index">接下来</span>
        <h2>按你的工作时间设置。</h2>
      </div>
      <a :href="withBase('/guide/getting-started')"
        >设置工作时间 <span>01 ↗</span></a
      >
      <a :href="withBase('/guide/reminders')"
        >添加和修改提醒 <span>02 ↗</span></a
      >
      <a :href="withBase('/guide/appearance')"
        >调整弹幕效果 <span>03 ↗</span></a
      >
      <a :href="withBase('/guide/data')">查看和导出记录 <span>04 ↗</span></a>
    </section>
  </div>
</template>
