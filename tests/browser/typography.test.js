// Isolated rendering checks, separate from the Chrome-API-double Node suite.
// npm install --prefix "$env:TEMP\lateron-test-dependencies" --no-audit --no-fund playwright-core
// $env:NODE_PATH = "$env:TEMP\lateron-test-dependencies\node_modules"
// node tests/browser/typography.test.js
// Uses installed Edge by default; set LATERON_BROWSER_CHANNEL for another Chromium channel.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = process.env.LATERON_TYPOGRAPHY_OUTPUT || path.join(os.tmpdir(), "lateron-typography");
const ORIGIN = "https://lateron.test";
let failures = 0;
let checks = 0;
const report = [];

async function check(name, action) {
  checks++;
  try { await action(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
}

async function typography(locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, weight: Number(style.fontWeight), size: style.fontSize };
  });
}

async function medium(locator) {
  const style = await typography(locator);
  assert.match(style.family, /^"?PingFang SC"?,\s*"?Microsoft YaHei"?,/);
  assert.ok(style.weight >= 500, `expected at least 500, received ${JSON.stringify(style)}`);
  return style;
}

async function screenshot(page, name, fullPage = false) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: path.join(OUTPUT, `${name}.png`), fullPage, animations: "disabled" });
}

async function platformFonts(page, selector) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    return (await session.send("CSS.getPlatformFontsForNode", { nodeId })).fonts;
  } finally { await session.detach(); }
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.LATERON_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    // Serve only repository assets. No personal profile, extension storage or external network.
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const file = path.resolve(ROOT, `.${decodeURIComponent(url.pathname)}`);
      if (url.origin !== ORIGIN || !file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) return route.abort();
      const ext = path.extname(file);
      if (ext === ".js") return route.fulfill({ contentType: "application/javascript", body: "" });
      if (ext === ".html") {
        // Chromium's extension_fonts.css sets a family directly on body.
        // A low-priority layer models that default without an installed extension:
        // an explicit app body rule wins, but a root-only family cannot inherit.
        const defaults = '<style>@layer extension-default-font { body { font-family: "Segoe UI", sans-serif; font-size: 12px; } }</style>';
        const html = fs.readFileSync(file, "utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
        return route.fulfill({ contentType: "text/html", body: html.replace("</head>", `${defaults}</head>`) });
      }
      return route.fulfill({ path: file });
    });
    const page = await context.newPage();

    for (const name of ["library", "settings", "sidepanel"]) {
      await page.goto(`${ORIGIN}/${name}.html`);
      let boot;
      if (name === "sidepanel") {
        await check("sidebar boot is Medium", async () => { boot = await medium(page.locator("body")); });
        await page.evaluate(() => {
          document.querySelectorAll("link[data-boot-style]").forEach((link) => { link.media = "all"; });
          document.body.classList.remove("booting");
          document.querySelector("#bootSkeleton")?.remove();
        });
      }
      await check(`${name} body and native controls inherit Medium`, async () => {
        const body = await medium(page.locator("body"));
        assert.equal(body.weight, 500, "normal copy must remain Medium");
        if (boot) assert.deepEqual(body, boot, "sidebar font must not change after styles load");
        for (const control of await page.locator('button, input:not([type="checkbox"]):not([type="file"]), select, textarea').all()) await medium(control);
      });
      if (name === "library") {
        await check("empty-state heading uses the interface family", () => medium(page.locator(".empty h2")));
        await page.evaluate(() => { document.querySelector("#emptyState").hidden = false; });
      }
      if (name === "sidepanel") await page.setViewportSize({ width: 320, height: 850 });
      await screenshot(page, name, true);
      await page.setViewportSize({ width: 1280, height: 900 });
    }

    for (const theme of ["light", "dark"]) {
      await page.goto(`${ORIGIN}/library.html?from=sidepanel&project=font-project&filter=all&focus=font-item`);
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
        const store = {
          laterOnItems: [{ id: "font-item", title: "中文字体 Medium English 123", description: "收藏库卡片正文应使用共享字体。", source: "example.com", favicon: "", image: "", status: "unread", projectId: "font-project", url: "https://example.com/article", savedAt: Date.now() }],
          laterOnProjects: [{ id: "font-project", name: "字体检查项目" }],
          laterOnCurrentItem: "font-item", laterOnSettings: { language: "zh-CN" }, laterOnCovers: {}
        };
        window.chrome = {
          storage: { local: { get: async () => store, set: async (patch) => Object.assign(store, patch) }, onChanged: { addListener() {} } },
          runtime: { getURL: (name) => new URL(name, location.href).href, sendMessage: async () => ({ ok: false }), onMessage: { addListener() {} } },
          tabs: { query: async () => [{ id: 1, windowId: 7 }] }
        };
      }, theme);
      await page.addScriptTag({ path: path.join(ROOT, "i18n.js") });
      await page.addScriptTag({ path: path.join(ROOT, "library.js") });
      const card = page.locator('#cardGrid .card[data-id="font-item"]');
      await card.waitFor();
      await check(`library ${theme} focused project overrides extension body font`, async () => {
        const body = await medium(page.locator("body"));
        assert.equal(body.size, "12px", "keep the browser's existing extension font size");
        assert.equal(body.weight, 500);
        for (const selector of ["h2", ".description", ".project-select", ".read-toggle"]) await medium(card.locator(selector));
        await medium(page.locator('.project-nav[data-project="font-project"]'));
        assert.equal(await card.locator(".project-select").inputValue(), "font-project");
        assert.match(await card.getAttribute("class"), /\bis-current\b/);
        const fonts = await platformFonts(page, '#cardGrid .card h2');
        assert.ok(fonts.length > 0 && fonts.every((font) => font.glyphCount > 0), "the preferred or fallback font must render the title");
        report.push({ scenario: `library-${theme}`, body, fonts });
      });
      await screenshot(page, `library-${theme}-focused`, true);
    }

    for (const language of ["zh-CN", "en"]) {
      await page.goto(`${ORIGIN}/sidepanel.html`);
      await page.setViewportSize({ width: 320, height: 850 });
      await page.evaluate((language) => {
        document.querySelectorAll("link[data-boot-style]").forEach((link) => { link.media = "all"; });
        const store = { laterOnItems: [{ id: "long", title: "中文和 English 的长网页标题，用于检查窄侧栏内的换行与按钮", description: "A long description for checking the existing line clamp and Medium font.", source: "example.com", favicon: "", image: "", status: "unread", projectId: "long-project", url: "https://example.com/article", savedAt: Date.now() }], laterOnProjects: [{ id: "long-project", name: "一个非常长的项目名称 / A long project name" }], laterOnActiveProject: "all", laterOnSettings: { language }, laterOnCovers: {} };
        window.chrome = {
          storage: { local: { get: async () => store, set: async (patch) => Object.assign(store, patch) }, onChanged: { addListener() {} } },
          runtime: { getURL: (name) => new URL(name, location.href).href, sendMessage: async () => ({ ok: false }), onMessage: { addListener() {} } },
          tabs: { query: async () => [{ id: 1, windowId: 7, url: "https://example.com/article" }], onActivated: { addListener() {} }, onUpdated: { addListener() {} } },
          windows: { getCurrent: async () => ({ id: 7 }) }
        };
      }, language);
      await page.addScriptTag({ path: path.join(ROOT, "i18n.js") });
      await page.addScriptTag({ path: path.join(ROOT, "sidepanel.js") });
      await page.locator("#items .item").waitFor();
      await check(`320px sidebar ${language} long content remains in view`, async () => {
        await medium(page.locator("#items .item h2"));
        await medium(page.locator("#items .item .description"));
        assert.equal(await page.evaluate(() => document.documentElement.lang), language);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "sidebar overflows horizontally");
        const button = await page.locator("#saveCurrent").boundingBox();
        assert.ok(button.x >= 0 && button.x + button.width <= 320, "add button is clipped");
      });
      await screenshot(page, `sidepanel-${language}`, true);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${ORIGIN}/library.html`);
    await page.addScriptTag({ path: path.join(ROOT, "i18n.js") });
    await page.addScriptTag({ path: path.join(ROOT, "dialog.js") });
    await page.evaluate(() => {
      void LaterOnDialog.prompt({ title: "编辑收藏信息 / Edit save", fields: [
        { name: "title", label: "标题", value: "中文与 English 混排的一篇长文章标题" },
        { name: "description", label: "摘要", value: "字体应保持 Medium，输入框与正文一致。", multiline: true }
      ] });
    });
    await check("edit inputs and textarea inherit Medium", async () => {
      await medium(page.locator(".lod-input"));
      await medium(page.locator(".lod-textarea"));
    });
    await screenshot(page, "edit-dialog");
    await page.evaluate(() => LaterOnDialog.close());

    await page.addScriptTag({ path: path.join(ROOT, "onboarding.js") });
    await page.evaluate(() => LaterOnOnboarding.open());
    await check("onboarding copy inherits Medium", () => medium(page.locator(".lon-guide-body")));
    await screenshot(page, "onboarding");

    for (const [language, theme, width] of [["zh-CN", "light", 1280], ["en", "dark", 320]]) {
      await page.goto(`${ORIGIN}/library.html`);
      await page.setViewportSize({ width, height: 900 });
      // Hostile website typography must not leak into the real Shadow DOM picker.
      await page.addStyleTag({ content: "body {font-family:monospace;font-weight:300}" });
      await page.addScriptTag({ path: path.join(ROOT, "picker-ui.js") });
      await page.evaluate(({ language, theme }) => openFolderPicker({ language, theme, selected: "", folders: [
        { id: "", name: language === "en" ? "Inbox" : "等待整理", count: 3 },
        { id: "long", name: "非常长的项目名称 / A long project name for typography review", count: 18 }
      ], pages: [{ title: "长文章标题 / A long article title for reading later", url: "https://example.com/article" }] }), { language, theme });
      await check(`picker ${language} input and controls use Medium`, async () => {
        for (const selector of [".lon-root", ".lon-summary", ".lon-new-input", ".lon-folder", ".lon-primary"]) {
          for (const element of await page.locator(selector).all()) await medium(element);
        }
        const bounds = await page.locator(".lon-primary").boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= 900, "confirm button is outside the viewport");
      });
      await screenshot(page, `picker-${language}`);
    }

    await page.goto(`${ORIGIN}/library.html`);
    await page.addStyleTag({ path: path.join(ROOT, "translation.css") });
    await page.addStyleTag({ content: "div {font-family:monospace;font-weight:300}" });
    await page.evaluate(() => {
      document.body.insertAdjacentHTML("beforeend", '<div id="lateron-translation-status">正在翻译 / Translating</div><div class="lateron-pill is-in">已添加 / Added</div><div class="toast pill-toast show">已添加到项目</div>');
      window.chrome = { runtime: { getURL: (name) => new URL(name, location.href).href, onMessage: {
        addListener: (listener) => { window.initReadingPosition = listener; }, removeListener() {}
      } } };
    });
    await page.addScriptTag({ path: path.join(ROOT, "content-reading-position.js") });
    await page.evaluate(() => initReadingPosition({ type: "LATERON_READING_POSITION_INIT", itemId: "fixture", y: 480, language: "zh-CN" }));
    await check("extension notifications and resume prompt use Medium", async () => {
      for (const selector of ["#lateron-translation-status", ".lateron-pill", ".toast.pill-toast", ".resume"]) await medium(page.locator(selector));
      assert.equal((await typography(page.locator(".resume"))).weight, 650);
    });
    await screenshot(page, "notifications");

    await page.goto(`${ORIGIN}/settings.html`);
    const sample = page.locator(".setting-label span").first();
    await sample.evaluate((element) => { element.id = "font-sample"; element.textContent = "中文字体 Medium English 123"; });
    const normal = await platformFonts(page, "#font-sample");
    // Replace just the first family with a nonexistent one: exercise the same remaining fallback stack.
    await page.evaluate(() => {
      const root = document.documentElement;
      root.style.fontFamily = getComputedStyle(root).fontFamily.replace(/"?PingFang SC"?/, '"LaterOn Missing Font"');
    });
    const fallback = await platformFonts(page, "#font-sample");
    await check("missing preferred font still renders every sample glyph", async () => {
      assert.ok(fallback.length > 0 && fallback.every((font) => font.glyphCount > 0));
      assert.equal(fallback.reduce((n, font) => n + font.glyphCount, 0), normal.reduce((n, font) => n + font.glyphCount, 0));
      assert.ok(fallback.every((font) => !/pingfang/i.test(font.familyName)));
      assert.ok((await typography(sample)).weight >= 500);
    });
    report.push({ browser: browser.version(), normal, fallback });
    await screenshot(page, "settings-fallback", true);
    await context.close();
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(OUTPUT, "report.json"), JSON.stringify({ checks, failures, report }, null, 2));
  console.log(`${checks - failures}/${checks} rendering checks passed; artifacts: ${OUTPUT}`);
  process.exitCode = failures ? 1 : 0;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
