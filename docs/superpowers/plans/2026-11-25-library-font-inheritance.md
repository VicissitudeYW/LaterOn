# 收藏库字体继承修复

- 用户报告：从侧栏进入项目并聚焦卡片的 library.html 刷新后仍未显示新字体。
- 用户已批准：显式继承共享字体、补渲染检查、同步本地扩展并直接更新 fork main，不创建 PR。
- 唯一业务范围：library.css 的 body 字体继承，不改字号、布局、颜色或分组行为。

## 原因与验收

Chromium 的 extension_fonts.css 为所有扩展页的 body 直接设置系统字体与字号。
共享 theme-vars.css 只在 :root 声明新字体；library.css 没有覆盖 body 的默认字体。
settings.css 已有 body 的 font-family: inherit，sidepanel.html 也直接声明了字体。
之前的 HTTPS 隔离检查没有模拟扩展默认字体，因此漏报。

官方源码：<https://chromium.googlesource.com/chromium/src/+/refs/heads/main/extensions/renderer/resources/extension_fonts.css>
Context7 的 Chrome Extensions 文档查询没有此内部样式细节，已直接核对官方源码。

验收使用低优先级 CSS layer 模拟 body 的默认 family 与 12px 字号，运行真实 library.js/i18n.js，
仅对 Chrome 存储与标签 API 使用替身；不读取已安装扩展或个人收藏。
检查深浅两种主题的分组聚焦卡片、标题、摘要、项目选择框、项目导航以及实际平台字体。
移除 body 继承后应复现失败；修复后正文保持 500 字重，字号仍为模拟的默认 12px。

## 进度

- [x] 复现收藏库正文的字体继承覆盖：15 项中 6 项字体断言失败，实际计算字体为 Segoe UI，设置与侧栏仍正常。
- [x] 修正收藏库字体继承并补回归检查：只在 body 增加 font-family: inherit，15/15 隔离渲染通过。
- [x] 完成全量检查，确认按授权直接推送 fork main。

计划工具在本会话不可用，进度与根目录临时 TODO CSV 同步记录；完成后删除 CSV。

## 验证与交付

- 54/54 Node 测试脚本，15/15 隔离 Edge 渲染检查，17 个根 JS 与浏览器测试语法、manifest JSON/7 个资源及 git diff --check 通过。
- 已检查深浅主题的真实收藏库脚本渲染截图；正文计算字体首选 PingFang SC、字重 500、字号仍为模拟的 12px。
- 依 requesting-code-review 技能委派只读独立审查，未发现 Critical/Important/Minor；未运行重复全量测试。
- 本地扩展目录先对 library.css 与 MEMORY.md 校验基线，再同步本次样式和记录；保留其他文件。
- 本提交按授权直接推送 https://github.com/VicissitudeYW/LaterOn 的 main，同时保留开发分支；推送后核对远端提交，不创建 PR。
- 已安装扩展页面受浏览器工具协议策略限制，未绕过访问；以上为隔离渲染，真实扩展重载与视觉确认留给用户。
