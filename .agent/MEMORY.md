# Active Tasks
- [x] 完成 Agent-coding 规范接入：新增项目规则与任务记忆、验证并提交。
- [x] Bug：在分组视图中，已分组网页卡片仍显示「等待整理」；应显示当前组别。
- [x] 功能：从扩展点击添加或使用快捷键添加网页时，可在弹窗中选择目标组，默认「等待整理」，并沿用现有弹窗风格。
- [x] 样式：将扩展字体调整为 PingFang SC Medium 或更粗的字重，并验证无该字体时的回退表现。
- [x] Bug：收藏库 library.html 刷新后仍未使用新字体；显式覆盖 body 的浏览器默认字体，补分组聚焦页面的渲染检查并同步 fork。

---

# 经验与交接（Agent 自主维护）
- `manifest.json` 使用 Manifest V3，配置 `background.js` 为 service worker、`sidepanel.html` 为 side panel、`settings.html` 为 options 页面。
- 默认语言为 `zh_CN`；仓库当前含 `_locales/zh_CN` 与 `_locales/en`。
- `library.js` 的 `createCard` 在填充组别选项后必须显式选择 `item.projectId || ""`；否则新建 select 默认停在首项「等待整理」。未分组网页以空值继续显示「等待整理」。
- 原始本地副本缺少测试目录；fork 有可直接运行的 `tests/*.test.js`，其中 DOM 检查依赖 jsdom。使用仓库外临时依赖，模拟 Chrome API 的 Node 检查不等于真实浏览器验收。
- 原目录保留在 `C:\Users\ADMIN\Documents\Add-on\LaterOn`，其早期历史与 fork 无关联。已配置 origin 为 `https://github.com/VicissitudeYW/LaterOn.git`；继续开发使用基于 fork main 的隔离工作区 `C:\Users\ADMIN\.codex\worktrees\lateron-save-project-picker\LaterOn`、分支 `codex/single-save-project-picker`，已带入卡片组别修复与任务规范。
- 单页添加默认复用现有浮层并传入空项目（等待整理）；仅 `askFolderOnSingle === false && askFolderOnSingleOptIn === true` 表示明确关闭。设置读取、监听与后台必须一致；整窗入口仍用上次项目，包括仅剩一个可添加网页时。
- 2026-11-25：单页切片经历 RED→GREEN，完整 54 个 Node 测试脚本、9 项新增设置检查、manifest 与根目录 JS 检查通过，只读独立审查无阻断；当时未重载真实浏览器扩展，未做实际视觉验收。
- 2026-11-25：字体切片统一首选 PingFang SC、正文 500，保留更粗层级并补齐控件继承；网页内提示的字体应声明在 Shadow 内部 .box，不能只放在可被宿主 div 样式覆盖的 :host，resume 的 font 简写也不能把 inherit 混在具体值中。
- 验证：54 个 Node 脚本、13 项隔离 Edge 渲染检查、manifest 7 个引用与 17 个根 JS 检查通过；实际平台字体为 PingFang SC Medium，模拟首选缺失后回退 Microsoft YaHei，中英文 320px 侧栏与长内容截图已检查，但仍未重载已安装扩展做端到端验收。panel-fast-open 的诊断用例改为有上限等待实际写入，避免两帧启动后固定 40ms 读记录的误报。
- 2026-11-25：收藏库漏用字体的原因是 Chromium 的 extension_fonts.css 对 body 直接设置系统字体，阻止继承 :root；library.css 应显式 font-family: inherit，保留浏览器原字号。隔离渲染须模拟这条默认规则，普通 HTTPS 页面不能直接代表扩展页。
- 此修复验证：模拟默认字体后 6 项 RED，修复后 15/15 渲染与 54/54 Node 脚本、17 个根 JS 及浏览器测试语法、manifest 7 个资源、diff 检查通过，独立只读审查无问题。已安装扩展协议被浏览器工具策略禁止访问，未绕过；仍需用户重新加载扩展后确认。用户要求直接更新 VicissitudeYW/LaterOn 的 main，不创建 PR。
