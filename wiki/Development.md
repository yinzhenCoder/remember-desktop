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
