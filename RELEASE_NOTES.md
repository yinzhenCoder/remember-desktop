# 弹幕提醒 v0.4.2

用桌面弹幕提醒你喝水、起身活动和上下班打卡。

## 下载与运行

下载 `BarrageReminder-Windows-x64.zip`，完整解压后运行 `弹幕提醒.exe`。请保留同目录全部文件。`SHA256SUMS.txt` 提供压缩包的 SHA-256 校验值。

## 本次内容

- 新增弹幕气泡 Logo，统一软件、托盘、网站和浏览器图标。
- 首页与 3 秒 SVG 入站动画支持深色/浅色模式。
- 提供工作日喝水、起身和上下班打卡提醒，可编辑弹幕文案、速度和分散程度。
- 重要提醒确认后可保留可拖动、自动淡出的浮条。
- 提供本地记录、JSON / CSV 导出，以及截图和动图使用文档。

## 升级

先从托盘退出旧版，再运行新版。沿用 `%APPDATA%/Remember/data` 保存设置与记录，不会因软件更名清空数据。

## 当前范围

适用于 Windows x64。尚未实现自动会议/共享屏幕识别、节假日调休和多浮条堆叠。点击「知道了」仅表示看到提醒，不表示事项已完成。

当前程序未做代码签名。自动测试与构建不替代不同 Windows 版本、缩放和多显示器环境的实际验证。

[使用文档](https://yinzhenCoder.github.io/remember-desktop/) · [反馈问题](https://github.com/yinzhenCoder/remember-desktop/issues)
