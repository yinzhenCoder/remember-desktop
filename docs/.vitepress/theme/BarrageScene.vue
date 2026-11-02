<script setup>
defineProps({ running: Boolean });
const chips = [
  { x: 40, y: 28, text: "喝水", icon: "cup", delay: "0s" },
  { x: 326, y: 104, text: "上班打卡", icon: "check", delay: ".09s" },
  { x: 92, y: 190, text: "起身活动", icon: "chair", delay: ".16s" },
  { x: 342, y: 278, text: "下班打卡", icon: "check", delay: ".04s" },
];
</script>

<template>
  <svg
    viewBox="0 0 640 380"
    role="img"
    aria-label="喝水、起身活动和上下班打卡的弹幕示意"
    :class="['barrage-scene', { 'is-running': running }]"
  >
    <path
      d="M12 60V12h48M580 12h48v48M628 320v48h-48M60 368H12v-48"
      class="scene-frame"
    />
    <path d="M28 150H612M28 242H612" class="scene-guide" />
    <g
      v-for="(chip, index) in chips"
      :key="chip.text"
      :transform="`translate(${chip.x} ${chip.y})`"
    >
      <g class="scene-chip" :style="{ animationDelay: chip.delay }">
        <rect
          width="244"
          height="62"
          rx="6"
          :class="{ 'scene-accent': index === 0 }"
        />
        <g
          transform="translate(18 18)"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <template v-if="chip.icon === 'cup'">
            <path
              d="M3 2h17l-2 23H5L3 2ZM20 6h3a5 5 0 0 1 0 10h-4M7 12h11M8-4v3M14-4v3"
            />
          </template>
          <template v-else-if="chip.icon === 'chair'">
            <rect x="5" y="-2" width="18" height="16" rx="3" />
            <path d="M2 11v10h24V11M14 21v6M6 28l8-1 8 1" />
          </template>
          <template v-else>
            <rect x="4" y="-2" width="21" height="28" rx="3" />
            <path d="m8 12 5 5 8-11M10-5h9" />
          </template>
        </g>
        <text x="66" y="39">{{ chip.text }}</text>
        <path d="M214 17h12M220 11v12" class="scene-plus" />
      </g>
    </g>
  </svg>
</template>
