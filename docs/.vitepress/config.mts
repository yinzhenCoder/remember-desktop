import { defineConfig } from "vitepress";
export default defineConfig({
  lang: "zh-CN",
  title: "弹幕提醒",
  description: "用桌面弹幕提醒你喝水、起身活动和上下班打卡。",
  base: "/remember-desktop/",
  lastUpdated: true,
  head: [
    [
      "link",
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/remember-desktop/logo.svg",
      },
    ],
  ],
  themeConfig: {
    logo: "/logo.svg",
    sidebarMenuLabel: "目录",
    returnToTopLabel: "返回顶部",
    darkModeSwitchLabel: "切换深色模式",
    nav: [
      { text: "使用", link: "/guide/getting-started" },
      { text: "开发", link: "/development/architecture" },
      { text: "路线图", link: "/roadmap" },
    ],
    sidebar: [
      {
        text: "使用",
        items: [
          { text: "开始使用", link: "/guide/getting-started" },
          { text: "提醒规则", link: "/guide/reminders" },
          { text: "弹幕设置", link: "/guide/appearance" },
          { text: "数据与导出", link: "/guide/data" },
          { text: "常见问题", link: "/guide/faq" },
        ],
      },
      {
        text: "开发",
        items: [
          { text: "开发结构", link: "/development/architecture" },
          { text: "发布与部署", link: "/development/publishing" },
          { text: "路线图", link: "/roadmap" },
        ],
      },
    ],
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/yinzhenCoder/remember-desktop",
      },
    ],
    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "搜索", buttonAriaLabel: "搜索文档" },
          modal: {
            noResultsText: "没有找到结果",
            resetButtonTitle: "清除搜索",
            footer: {
              selectText: "选择",
              navigateText: "切换",
              closeText: "关闭",
            },
          },
        },
      },
    },
    outline: { label: "本页内容" },
    docFooter: { prev: "上一页", next: "下一页" },
    lastUpdated: { text: "更新于" },
    editLink: {
      pattern:
        "https://github.com/yinzhenCoder/remember-desktop/edit/main/docs/:path",
      text: "编辑此页",
    },
    footer: {
      message: "MIT License",
      copyright: "Copyright © 2026 yinzhenCoder",
    },
  },
});
