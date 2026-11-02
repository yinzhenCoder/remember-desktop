# 发布与部署

在已登录 GitHub CLI 的 Git Bash 中执行 `bash scripts/publish.sh`，可推送代码、启用 Pages 并同步已初始化的 Wiki。需要代理时，在命令前设置 `HTTPS_PROXY`。GitHub CLI 的令牌需包含 `repo` 和 `workflow` 权限，脚本通过凭据助手使用现有登录，不保存令牌。

## 文档站

仓库 Settings → Pages 的 Source 选择 GitHub Actions。推送 main 后由 docs.yml 构建和部署，项目基路径是 `/remember-desktop/`。

## Windows 发布

推送 v 开头的标签触发 release.yml。工作流执行测试、构建 Windows 便携目录并上传 GitHub Release。发布前应进行 Windows 实机验证。

## GitHub Wiki

执行 `npm run wiki:generate` 生成 wiki 目录。GitHub Wiki 首次需要在网页创建 Home 页，然后克隆 `https://github.com/yinzhenCoder/remember-desktop.wiki.git`，复制 wiki 目录里的 Markdown 文件并提交推送。

Wiki 内容也保存在主仓库。文档站独立部署，不依赖 Wiki 初始化。
