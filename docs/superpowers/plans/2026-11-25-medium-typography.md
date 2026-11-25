# Medium Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this approved slice inline. Steps use checkbox syntax for tracking.

**Goal:** 扩展界面统一首选 PingFang SC、正文至少 Medium，并验证回退。

**Architecture:** 共享页面从 theme-vars.css 继承；侧栏启动、选择器与网页内通知各自声明相同字体栈。只修正被浏览器控件默认值或 font 简写重置的字重，不改变现有布局。

**Tech Stack:** Manifest V3、原生 HTML/CSS/JavaScript；已有 Node 脚本及独立 Playwright 浏览器渲染检查。

**Spec:** docs/superpowers/specs/2026-11-25-medium-typography-design.md

## Global Constraints

- 普通文案字重 500；保留现有更粗层级。
- 只引用已安装字体；不改变布局、字号、颜色、交互、网站正文。
- 一次仅处理字体切片。正常推送 codex/single-save-project-picker，不合并 main。
- 基线已保存在仓库外临时目录，原目录同步前复核，避免覆盖新编辑。

## Review Focus

- 侧栏启动字体与完成加载后的字体一致，避免 font 简写恢复成 400。
- 编辑弹窗 textarea、设置控件与选择器 input 不保留浏览器默认字体/字重。
- 两个 Shadow DOM 浮层与通知不继承宿主网站字体。
- 中英文及长项目名在 320px 侧栏、弹窗中仍可读，操作按钮可见。
- 移除首选字体后后备字体可渲染；检查实际平台字体而非只读取 CSS 字符串。

## Task 1: 字体切片

**Files:** theme-vars.css、sidepanel.html、library.css、picker-ui.js、dialog.css、settings.css、translation.css、content-reading-position.js；新增 tests/browser/typography.test.js；修正 tests/panel-fast-open.test.js 中固定等待时间的诊断断言。

**Interfaces:** 页面继续使用现有样式与浮层 API，无公共接口变化。测试读取真实页面/样式并运行真实浮层代码，Chrome API 使用最小替身；依赖装在仓库外。

- [x] 增加浏览器检查，断言真实计算字体首选与正文/输入框至少 500，并在修改前观察失败。
- [x] 最小修改共享、启动和独立浮层字体声明，保留更粗语义字重。
- [x] 浏览器检查通过，输出中英文宽/窄视口截图；用平台字体检查和首选字体替换验证回退。
- [x] 运行全部 tests/*.test.js、根目录 node --check、manifest 路径检查与 git diff --check。
- [x] 运行 impeccable changed detector；独立只读审查，处理有实质影响的问题。
- [x] 更新 .agent/MEMORY.md、完成 CSV；按授权提交、推送并校验同步原目录。

## Execution record

- 2026-11-25：用户已批准方案和继续实施；使用既有隔离工作区。计划工具此前返回 unsupported call，CSV 为当前状态记录，不重复无效调用。
- Pre-flight: no shared API changes; 一项任务覆盖统一字体及验证。
- 浏览器初跑 11 项均 RED，修改后 11 项 GREEN；审查发现宿主 div 样式能覆盖 resume 字体，单页复现 RED 后将字体移到 Shadow 内部 .box，补 hostile 样式与两种语言的真实侧栏渲染检查。
- panel-fast-open 的固定 40ms 等待在当前样式下两次未等到异步诊断；HEAD 导出用例通过。仅将该测试改为有上限等待诊断记录出现，保留原六项断言；生产启动与性能逻辑不变。
- impeccable changed detector 的现有颜色、低对比度、小字号与启动动画告警保留，本切片不修改这些视觉规则。
- 最终验证：54/54 个 Node 脚本，13/13 项隔离 Edge 渲染检查，17 个根目录 JS 语法与浏览器测试语法、manifest JSON/7 个资源引用、git diff --check 全部通过。测试依赖 jsdom 26.1.0 与 playwright-core 1.65.1 均在仓库外临时目录。
- 已查看实际渲染截图（中英文 320px 侧栏含真实长项目/卡片、深浅选择器、编辑框与通知）；平台字体报告为 PingFang SC Medium，模拟移除首选后为 Microsoft YaHei，样本各渲染 23 个字形。此结果只代表当前 Windows/Edge 隔离环境，不代表 macOS 或已安装扩展端到端验收。
- 独立审查的 1 项 Important 已按 RED→GREEN 修复（resume 宿主字体隔离）；侧栏截图覆盖缺口已通过真实 sidepanel.js/i18n.js 渲染补齐，最终完整套件绿色。
