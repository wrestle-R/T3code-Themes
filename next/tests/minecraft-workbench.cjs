const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require('playwright');
const path = require('node:path');

async function run(browser) {
  const theme = JSON.parse(await readFile(process.env.MINECRAFT_THEME_FILE ||
    path.join(__dirname, '../public/downloads/minecraft.json'), 'utf8'));
  assert.equal(theme.canvas, '#121316');
  assert.ok(theme.css.length < 100000);
  assert.doesNotMatch(theme.css, /--mc-portal|t3-minecraft-roam/);

  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html class="dark"><style>
    body { margin: 16px; }
    [data-chat-canvas] { max-width: 440px; }
    [data-chat-composer-main-surface] { min-height: 64px; }
    ${theme.css}
    </style><aside data-slot="sidebar">
      <button data-sidebar-row="shelf:working">Working</button>
      <button data-sidebar-row="shelf:settled">Settled</button>
      <div data-thread-item id="background-thread" hidden><button data-sidebar-row="thread:2">Another thread<span class="text-info-foreground"><svg></svg>Working 37s</span></button></div>
      <div data-thread-item><button data-sidebar-row="thread:current" aria-current="page">Review diff<span class="text-info-foreground"><svg></svg>Working 37s</span></button></div>
    </aside>
    <main data-chat-canvas>
      <header data-chat-header><button aria-label="Open in VS Code"><svg><path /></svg></button>
        <button aria-label="Add project script"><svg><path /></svg></button></header>
      <div data-workspace-area="conversation"><div data-timeline-row-kind="work"></div>
        <p data-user-message-bubble>Review this change</p><pre class="chat-markdown-codeblock">const ready = true;</pre></div>
      <div data-workspace-area="composer"><button type="button">Details</button><form data-chat-composer-form>
        <div data-chat-composer-main-surface><label>Ask anything <input></label>
          <button type="button" aria-label="Attach files"><svg><path /></svg></button>
          <button type="button" id="stop" hidden aria-label="Stop generation"><svg></svg></button>
          <button type="button" aria-label="Choose branch"><svg class="lucide-git-branch"><path /></svg></button>
          <span data-composer-mention-chip><svg><path /></svg></span>
          <span data-composer-skill><svg><path /></svg></span>
          <div data-composer-command-drawer><div data-slot="command-item"><svg class="lucide-terminal"><path /></svg></div></div>
          <span data-chat-provider-model-picker aria-label="Claude Opus"></span>
        </div></form></div>
      <button id="diff"><span class="text-diff-addition-foreground">+84</span> <span class="text-diff-deletion-foreground">-168</span></button>
    </main>`);
  const dock = page.locator('[data-chat-composer-main-surface]');
  const buddy = () => dock.evaluate(el => {
    const sprite = getComputedStyle(el, '::after');
    return { size: sprite.width, dockRadius: getComputedStyle(el).borderRadius, pose: sprite.backgroundPositionX,
      image: sprite.backgroundImage, motion: sprite.animationName, bottom: sprite.bottom,
      badge: getComputedStyle(el, '::before').content, particles: getComputedStyle(el, '::before').backgroundImage,
      aura: getComputedStyle(el, '::before').animationName, lift: sprite.getPropertyValue('--mc-lift').trim(),
      pointerEvents: sprite.pointerEvents };
  });

  // Match a real composer which inserts and removes the Stop action.
  const stopMarkup = await page.locator('#stop').evaluate(el => {
    el.hidden = false;
    const markup = el.outerHTML;
    el.remove();
    return markup;
  });
  assert.equal((await buddy()).size, '64px');
  assert.equal((await buddy()).particles, 'none, none');
  assert.equal((await buddy()).dockRadius, '2px');
  assert.equal((await buddy()).motion, 'minecraft-idle');
  assert.equal((await buddy()).pointerEvents, 'none');
  assert.equal(await dock.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(15, 17, 23, 0.86)');
  assert.equal(await dock.evaluate(el => getComputedStyle(el).backdropFilter), 'blur(12px)');
  assert.equal(await dock.evaluate(el => getComputedStyle(el).borderTopWidth), '2px');
  assert.equal(await dock.evaluate(el => getComputedStyle(el, '::after').backgroundImage ===
    getComputedStyle(document.documentElement).getPropertyValue('--mc-claude').trim()), true);
  for (const surface of ['[data-workspace-area="conversation"]', 'body']) {
    const tile = await page.locator(surface).evaluate(el => {
      const style = getComputedStyle(el);
      return { image: style.backgroundImage, size: style.backgroundSize };
    });
    assert.match(tile.image, /data:image\/png;base64/);
    assert.equal(tile.size, '96px 96px');
  }
  assert.equal(await page.locator('[data-slot="sidebar"]').evaluate(el => getComputedStyle(el).backdropFilter), 'blur(16px) saturate(1.25)');
  const currentThread = page.locator('[data-sidebar-row="thread:current"]');
  assert.equal(await currentThread.evaluate(el => getComputedStyle(el).animationName), 'minecraft-enchantment');
  await page.evaluate(async () => {
    const css = getComputedStyle(document.documentElement);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    for (const name of ['openai', 'claude', 'gemini', 'opencode', 'creeper', 'fox', 'deepslate']) {
      const raw = css.getPropertyValue('--mc-' + name).trim();
      const image = new Image();
      image.src = raw.slice(5, -2);
      await image.decode();
      if (image.width !== (name === 'deepslate' ? 32 : 128) || image.height !== 32) throw new Error('Wrong pixel grid: ' + name);
      if (name === 'deepslate') continue;
      context.clearRect(0, 0, 128, 32);
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, 32, 32);
      if (!Array.from({ length: data.length / 4 }, (_, i) => 4 * i).some(i =>
        data[i] === 9 && data[i + 1] === 10 && data[i + 2] === 12 && data[i + 3] === 255)) throw new Error('Missing silhouette: ' + name);
    }
  });
  assert.equal(await page.getByRole('button', { name: 'Working', exact: true }).evaluate(el =>
    getComputedStyle(el).fontFamily.includes('Minecraft UI')), true);
  assert.equal(await page.evaluate(async () => {
    await document.fonts.load('10px "Minecraft UI"', 'Working 37s');
    return [...document.fonts].some(font => font.family.includes('Minecraft UI') && font.status === 'loaded');
  }), true);
  for (const name of ['Attach files', 'Choose branch', 'Open in VS Code', 'Add project script']) {
    assert.match(await page.getByRole('button', { name }).locator('svg').evaluate(el =>
      getComputedStyle(el).backgroundImage), /data:image\/png;base64/);
  }
  for (const selector of ['[data-composer-mention-chip] svg', '[data-composer-skill] svg', '[data-slot="command-item"] svg']) {
    assert.match(await page.locator(selector).evaluate(el => getComputedStyle(el).backgroundImage), /data:image\/png;base64/);
  }
  for (const selector of ['[data-user-message-bubble]', '.chat-markdown-codeblock', '#diff']) {
    assert.doesNotMatch(await page.locator(selector).evaluate(el => getComputedStyle(el).fontFamily), /Minecraft UI/);
  }
  assert.equal(await page.locator('.chat-markdown-codeblock').evaluate(el => getComputedStyle(el).borderTopWidth), '2px');
  assert.equal(await page.locator('.text-diff-addition-foreground').evaluate(el => getComputedStyle(el).color), 'rgb(105, 214, 161)');
  assert.equal(await page.locator('.text-diff-deletion-foreground').evaluate(el => getComputedStyle(el).color), 'rgb(255, 133, 133)');

  await dock.evaluate((el, markup) => el.insertAdjacentHTML('beforeend', markup), stopMarkup);
  assert.equal((await buddy()).pose, '100%');
  assert.equal((await buddy()).motion, 'minecraft-working');
  assert.equal((await buddy()).particles, 'none, none');
  assert.equal((await buddy()).badge, '"◆"');
  assert.equal(await page.locator('#stop').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(217, 43, 43)');
  const picker = page.locator('[data-chat-provider-model-picker]');
  for (const [label, sprite] of [
    ['Haiku 4.5', '--mc-claude-fast'], ['Gemini 2.5 Flash', '--mc-gemini-fast'],
    ['GPT-5 Mini', '--mc-openai-fast'], ['GPT-5 Nano', '--mc-openai-fast'],
    ['Sonnet 4.6', '--mc-claude'], ['GPT-5', '--mc-openai'], ['Gemini 2.5', '--mc-gemini'],
    ['Opus 4.6', '--mc-claude-heavy'], ['Gemini 2.5 Pro', '--mc-gemini-heavy'],
    ['OpenAI o1', '--mc-openai-heavy'], ['OpenAI o3', '--mc-openai-heavy'],
    ['6.2 Sol, Medium', '--mc-openai-heavy'], ['6.1 Sol High', '--mc-openai-heavy'],
  ]) {
    await picker.evaluate((el, value) => el.setAttribute('aria-label', value), label);
    assert.equal(await dock.evaluate((el, property) => getComputedStyle(el, '::after').backgroundImage ===
      getComputedStyle(document.documentElement).getPropertyValue(property).trim(), sprite), true, label);
  }
  for (const model of ['Haiku 4.5', 'Sonnet 4.6', '6.2 Sol']) {
    for (const [level, animation, lift] of [
      ['Low', 'none', '0px'], ['Medium', 'minecraft-glints', '0px'], ['High', 'minecraft-max-glints', '-4px'],
    ]) {
      await picker.evaluate((el, label) => el.setAttribute('aria-label', label), model + ', ' + level);
      const action = await buddy();
      assert.equal(action.aura, animation);
      assert.equal(action.lift, lift);
      if (level === 'Low') assert.equal(action.particles, 'none, none');
      else assert.match(action.particles, /data:image\/png;base64.*linear-gradient/);
    }
  }
  await page.setViewportSize({ width: 320, height: 600 });
  await page.locator('#stop').click({ trial: true });
  assert.equal(await page.getByRole('button', { name: 'Choose branch' }).evaluate(el =>
    getComputedStyle(el).color), 'rgb(56, 189, 248)');
  const row = page.locator('[data-timeline-row-kind]');
  await row.evaluate(el => { el.innerHTML = '<div data-v2-item-type="reasoning"><span class="live-tool-shine">Thinking</span></div>'; });
  assert.equal((await buddy()).pose, '66.6667%');
  assert.equal((await buddy()).aura, 'minecraft-max-glints');
  await dock.evaluate(el => { el.parentElement.insertAdjacentHTML('afterbegin', '<div data-chat-composer-top-drawer>Review request</div>'); });
  assert.equal((await buddy()).badge, '"!"');
  await page.locator('[data-chat-composer-top-drawer]').evaluate(el => el.remove());
  await page.locator('#stop').evaluate(el => el.remove());
  await row.evaluate(el => { el.innerHTML = '<div data-v2-item-type="error">Failed</div>'; });
  assert.equal((await buddy()).motion, 'minecraft-hurt');
  assert.equal((await buddy()).badge, '"×"');
  await row.evaluate(el => { el.insertAdjacentHTML('afterend', '<div data-timeline-row-kind="user">Try again</div>'); });
  assert.equal((await buddy()).motion, 'minecraft-idle');
  assert.equal(await dock.evaluate(el => {
    const idle = el.getAnimations({ subtree: true }).find(animation => animation.animationName === 'minecraft-idle');
    idle.pause();
    idle.currentTime = 3800;
    const pose = getComputedStyle(el, '::after').backgroundPositionX;
    idle.cancel();
    return pose;
  }), '33.3333%');
  await dock.evaluate(el => { el.insertAdjacentHTML('beforebegin', '<div data-thread-now-line role="alert"><span><svg class="text-warning-foreground"></svg></span>Agent not responding to Stop</div>'); });
  assert.equal((await buddy()).motion, 'minecraft-hurt');
  await page.locator('[data-thread-now-line]').evaluate(el => el.remove());
  await page.locator('#background-thread').evaluate(el => { el.hidden = false; });
  assert.equal((await buddy()).badge, '"z"');
  assert.equal(await page.locator('#background-thread .text-info-foreground').evaluate(el => getComputedStyle(el).color), 'rgb(128, 255, 32)');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal((await buddy()).motion, 'none');
  assert.equal(await currentThread.evaluate(el => getComputedStyle(el).animationName), 'none');

  for (const width of [320, 640, 1440]) {
    await page.setViewportSize({ width, height: 600 });
    assert.ok(await page.locator('#diff').isVisible());
    await page.locator('#diff').click({ trial: true });
    await page.getByRole('button', { name: 'Details' }).click({ trial: true });
    const details = await page.getByRole('button', { name: 'Details' }).boundingBox();
    const composer = await dock.boundingBox();
    assert.ok(composer.y - 64 >= details.y + details.height, 'The buddy clears Details');
    assert.ok(await page.getByRole('textbox', { name: 'Ask anything' }).isVisible());
  }
  await page.close();
  console.log('Minecraft composer, status, palette, icons, typography, and responsive controls passed.');
}

module.exports = run;
if (require.main === module) (async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  try { await run(browser); } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
