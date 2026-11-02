# 贡献指南

问题反馈请包含版本、Windows 版本、显示缩放、复现步骤和实际结果。截图请遮挡个人信息，不要上传原始提醒记录或凭据。

提交前执行 `npm test`、`npm run format:check`、`npm run docs:build`。修改原生窗口时，请验证普通/重要提醒、连续预览、确认/关闭/超时及多显示器。

新增配置须兼容旧设置。「已确认」不得改成「已完成」。功能讨论先提交 Issue，PR 说明变化与验证结果。

文档在 `docs/` 修改，执行 `npm run wiki:generate` 更新 Wiki 源文件。
