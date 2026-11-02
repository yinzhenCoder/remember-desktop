# 开发结构

| 路径            | 用途                         |
| --------------- | ---------------------------- |
| src/main.cjs    | 窗口、调度、托盘和 IPC       |
| src/domain.cjs  | 验证与时间计算               |
| src/store.cjs   | 配置与追加式记录             |
| src/preload.cjs | 受限 IPC 桥接                |
| src/ui          | 管理页、弹幕、确认条、浮条   |
| test            | 逻辑、DOM 和窗口生命周期测试 |

Renderer 禁用 Node 集成并启用上下文隔离，IPC 校验来源。弹幕窗口穿透鼠标，确认窗口单独接收点击。

`npm test` 包括模拟 Electron 的检查，不等于 Windows 实机验证。`npm run test:desktop` 需要能启动 Electron 调试进程的环境。测试缓存保存在 `.cache/`。

需要 Node.js 24。执行 `npm run build:portable` 构建到 `dist/`，开发依赖不进入应用包。

## 文档图片

截图和操作演示来自实际前端代码，使用独立的示例数据与模拟 IPC，不读取个人数据。`npm run docs:media` 需要本机 Chrome，可生成截图和演示帧；再使用 Python Pillow 执行 `python scripts/encode-docs-gif.py` 编码 GIF。媒体文件提交在 `docs/public/images/`，正常文档构建不需要重录。

## 首页动画

自定义主题在 `docs/.vitepress/theme/`。首次进入首页时播放约 3 秒的全屏 SVG 动画，可以跳过或按 Esc 关闭，同一会话不重复播放。首页可手动重播，系统启用减少动态效果时不播放。
