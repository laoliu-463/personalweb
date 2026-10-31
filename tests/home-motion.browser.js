// 使用 Playwright browser_run_code 的 filename 参数运行。
async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const origin = 'http://127.0.0.1:4321';
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/articles/');
  const articlePath = await page.locator('.article-row').first().getAttribute('href');
  check(articlePath, '文章列表没有正文入口');
  const routes = ['/', '/projects/', '/articles/', '/about/', articlePath];
  const results = [];
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      const response = await page.goto(origin + route);
      check(response?.ok(), route + ' 无法访问');
      await page.locator('.scene-image').evaluate(node => node.decode());
      await page.waitForFunction(() => document.querySelector('[data-desk-scene]')?.dataset.running === 'true');
      const state = await page.evaluate(() => ({
        headers: document.querySelectorAll('.site-header').length,
        footers: document.querySelectorAll('.site-footer').length,
        activeLinks: document.querySelectorAll('.site-nav [aria-current="page"]').length,
        controls: document.querySelectorAll('.lamp-toggle,.motion-button,.lamp-off,#mood-widget').length,
        overflow: document.documentElement.scrollWidth > innerWidth,
        background: getComputedStyle(document.documentElement).backgroundColor,
        heading: document.querySelector('h1')?.textContent,
        imageWidth: document.querySelector('.scene-image').getBoundingClientRect().width,
        audioPaused: document.querySelector('audio').paused,
        oldBackdrop: !!document.querySelector('.grain,.scenery-canvas,.glass-panel'),
      }));
      check(state.headers === 1 && state.footers === 1, route + ' 没有共用导航或页脚');
      check(state.activeLinks === 1, route + ' 导航状态不正确');
      check(state.controls === 0, route + ' 仍有动效或灯光开关');
      check(!state.overflow, width + 'px 的 ' + route + ' 横向溢出');
      check(state.background === 'rgb(238, 237, 231)', route + ' 配色没有统一');
      check(state.heading && state.imageWidth > 100 && state.audioPaused && !state.oldBackdrop, route + ' 页面内容或媒体状态不正确');
      results.push({ width, route, passed: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/');
  await page.locator('.scene-image').evaluate(node => node.decode());
  await page.waitForFunction(() => document.querySelector('[data-desk-scene]').dataset.running === 'true');
  const steam = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas.steam');
    const gl = canvas.getContext('webgl');
    if (!gl) return false;
    const buffer = new Uint8Array(canvas.width * canvas.height * 4);
    const values = new Set();
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      let total = 0;
      for (let p = 3; p < buffer.length; p += 4) total += buffer[p];
      if (total > 0) values.add(total);
      if (values.size >= 3) return true;
    }
    return false;
  });
  check(steam, '热气没有持续绘制');
  const before = await page.locator('canvas.rain').evaluateAll(nodes => nodes.map(node => node.toDataURL()));
  await page.evaluate(async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => requestAnimationFrame(resolve)); });
  const after = await page.locator('canvas.rain').evaluateAll(nodes => nodes.map(node => node.toDataURL()));
  check(before.every((value, i) => value !== after[i]), '雨滴没有持续运动');
  await page.getByRole('link', { name: '看看我的作品' }).click();
  check(await page.locator('[data-desk-scene]').getAttribute('data-running') === 'true', '滚动后环境动效停止');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  check(await page.locator('canvas.rain,canvas.steam').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).display !== 'none')), '环境效果没有按要求持续显示');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '文字', exact: true }).click();
  await page.waitForURL('**/articles/');
  await page.locator('.article-row').first().click();
  await page.waitForURL('**' + articlePath);
  check(await page.locator('.article-prose').innerText(), '正文为空');
  const toc = page.locator('.article-toc a');
  if (await toc.count()) {
    const hash = await toc.first().getAttribute('href');
    check(await page.locator(hash).count() === 1, '目录没有指向正文标题');
  }
  await page.goto(origin + '/');
  const browser = page.context().browser();
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  try {
    const fallback = await noJs.newPage();
    await fallback.goto(origin + '/articles/');
    check(await fallback.locator('.article-row').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).opacity === '1')), '禁用脚本后文章不可读');
  } finally { await noJs.close(); }
  return { pages: results, continuousSteam: true, continuousRain: true, noAnimationControls: true, navigation: true, articleAndToc: true, noJsReading: true };
}
