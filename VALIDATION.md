# 验证范围

自动测试涵盖调度、配置兼容、事件存储、DOM 交互和模拟 Electron 窗口生命周期。原生鼠标点击、拖动、显示缩放和实际帧率需要 Windows 实机验证。

提交前执行 npm test、npm run format:check、npm run docs:build。

0.4.1 已验证软件更名后的旧数据目录兼容性。文档界面以实际前端代码和示例数据在 Chrome 中渲染；首页检查覆盖约 3 秒自动结束、重播、Esc 跳过、图文链接、减少动态效果及 375px 手机宽度。
