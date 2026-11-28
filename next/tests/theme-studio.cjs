// Start Next.js locally, then run npm run test:browser.
// Set CHROME_PATH to use an existing Chromium installation.
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const site = process.env.SITE_URL || 'http://localhost:3000';

function readPond(frame, includeHidden = false) {
  return frame.locator('.demo').evaluate((pond, includeHidden) => {
    const canvas = pond.querySelector('[data-assistant-citation-viewport]');
    const slots = [[pond, '::before'], [pond, '::after'], [canvas, '::before'], [canvas, '::after']];
    return slots.flatMap(([host, pseudo]) => {
      const style = getComputedStyle(host, pseudo);
      return style.content === 'none' || (!includeHidden && Number(style.opacity) === 0) ? [] : [{
        color: style.getPropertyValue('--koi-light').trim(),
        motion: style.animationName,
        track: style.getPropertyValue('--koi-track').trim(),
        duration: style.animationDuration,
        opacity: Number(style.opacity),
        playback: style.animationPlayState,
        exitTurn: style.getPropertyValue('--koi-exit-turn').trim(),
      }];
    });
  }, includeHidden);
}

async function exportedTheme(page) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const file = await downloading;
  return JSON.parse(await readFile(await file.path(), 'utf8'));
}

async function grainContrast(page, pond) {
  const screenshot = await pond.screenshot({ scale: 'css' });
  return page.evaluate(async source => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const bitmap = await createImageBitmap(await (await fetch(source)).blob());
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 12, 85, 64, 64, 0, 0, 64, 64);
    bitmap.close();
    const pixels = context.getImageData(0, 0, 64, 64).data;
    const samples = [...pixels].filter((_, index) => index % 4 === 0);
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    return Math.sqrt(samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length);
  }, 'data:image/png;base64,' + screenshot.toString('base64'));
}

async function setSlider(slider, value) {
  const min = Number(await slider.getAttribute('aria-valuemin'));
  await slider.press('Home');
  for (let remaining = value - min; remaining > 0;) {
    const step = remaining >= 10 ? 10 : 1;
    await slider.press(step === 10 ? 'PageUp' : 'ArrowRight');
    remaining -= step;
  }
  assert.equal(await slider.getAttribute('aria-valuenow'), String(value));
}

const openPanel = (page, name) => page.getByRole('button', { name, exact: true }).click();

async function testStudio(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(site);
  await page.goto(new URL('/koi-pond', site).href);
  const frame = page.frameLocator('.studio-viewport iframe');
  const add = provider => page.getByRole('button', { name: 'Add ' + provider + ' subagent' });
  const finish = provider => page.getByRole('button', { name: 'Finish ' + provider + ' subagent' });
  const spawn = add('Claude');
  await openPanel(page, 'Agents');
  await spawn.waitFor();
  await page.getByRole('button', { name: 'Download JSON' }).waitFor();
  const reset = page.getByRole('button', { name: 'Reset' });
  assert.ok(await reset.isDisabled());
  await page.getByLabel('Main thread model').selectOption('OpenAI');
  assert.equal(await page.getByRole('slider', { name: 'Reflection strength' }).count(), 0);
  assert.equal(await frame.locator('.demo').evaluate(pond => getComputedStyle(pond).backgroundImage), 'none');
  assert.equal(await frame.locator('.demo').evaluate(pond => getComputedStyle(pond).backgroundColor), 'rgb(16, 16, 16)');
  assert.ok(await frame.locator('.demo').evaluate(pond => {
    const canvas = pond.querySelector('[data-assistant-citation-viewport]').getBoundingClientRect();
    const viewport = pond.getBoundingClientRect();
    return ['x', 'y', 'width', 'height'].every(key => canvas[key] === viewport[key]);
  }));
  await spawn.click();
  assert.deepEqual((await readPond(frame)).map(fish => fish.motion), ['t3-koi-openai', 't3-koi-claude']);
  await add('Gemini').click();
  await add('OpenAI').click();
  assert.ok(await page.getByText('3 of 3 running').isVisible());
  assert.equal(await spawn.isDisabled(), true);
  assert.deepEqual((await readPond(frame)).map(fish => fish.motion), [
    't3-koi-openai', 't3-koi-claude', 't3-koi-gemini', 't3-koi-openai',
  ]);
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  assert.equal(await frame.locator('.demo').evaluate(pond => getComputedStyle(pond).backgroundImage), 'none');
  assert.equal(await frame.locator('.demo').evaluate(pond => getComputedStyle(pond).backgroundColor), 'rgb(229, 229, 229)');
  assert.deepEqual((await readPond(frame)).slice(0, 3).map(fish => fish.color), [
    '#f2f2f2', '#e3d8c1', '#a9d7ff',
  ]);

  // Opening a child pane does not move the fish or give it a duplicate school.
  await frame.locator('.demo').evaluate(pond => {
    const side = document.createElement('div');
    side.dataset.sideChatPane = 'child-thread';
    const copy = pond.cloneNode(true);
    copy.className = 'side-demo';
    side.append(copy);
    pond.append(side);
  });
  assert.equal((await readPond(frame)).length, 4);
  assert.equal(await frame.locator('.side-demo').evaluate(pond => getComputedStyle(pond, '::before').content), 'none');
  await frame.locator('[data-side-chat-pane]').evaluate(pane => pane.remove());
  const fade = () => frame.locator('.demo').evaluate(async pond => {
    await Promise.all(pond.getAnimations({ subtree: true })
      .filter(animation => animation instanceof CSSTransition)
      .map(animation => animation.finished));
  });

  await finish('Gemini').click();
  const [, first, second, third] = await readPond(frame, true);
  assert.ok(second.opacity > 0 && second.playback === 'paused');
  assert.ok([first, third].every(fish => fish.playback === 'running'));
  await fade();
  assert.deepEqual((await readPond(frame)).map(fish => fish.motion), [
    't3-koi-openai', 't3-koi-claude', 't3-koi-openai',
  ]);
  assert.equal((await readPond(frame, true))[2].exitTurn, '34deg');

  // A collapsed native group reports the number working, with no per-row status.
  await frame.locator('.demo [data-subagent-group] > button').first()
    .evaluate(button => button.setAttribute('aria-expanded', 'false'));
  await fade();
  assert.equal((await readPond(frame)).length, 3);
  await finish('OpenAI').click();
  await fade();
  assert.equal((await readPond(frame)).length, 2);
  await finish('Claude').first().click();
  await fade();
  assert.equal((await readPond(frame)).length, 1);

  await page.getByLabel('Main thread model').selectOption('Claude');
  await openPanel(page, 'Fish');
  const claudeLapTime = page.getByRole('slider', { name: 'Claude lap time' });
  await setSlider(claudeLapTime, 91);
  await openPanel(page, 'Colors');
  const lightHex = page.getByRole('textbox', { name: 'Light base hex' });
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await lightHex.fill('DDE4DC');
  assert.ok(await page.getByRole('radio', { name: 'Light', exact: true }).isChecked());
  assert.equal(await page.locator('input[name="light"]').inputValue(), '#dde4dc');
  await lightHex.fill('#bad');
  assert.equal(await lightHex.getAttribute('aria-invalid'), 'true');
  assert.ok(await page.getByText('Enter 6 hex digits').isVisible());
  assert.ok(await page.getByRole('button', { name: 'Download JSON' }).isDisabled());
  assert.equal(await frame.locator('.demo').evaluate(pond => getComputedStyle(pond).backgroundColor), 'rgb(221, 228, 220)');
  await lightHex.fill('DDE4DC');
  await lightHex.blur();
  assert.equal(await lightHex.inputValue(), '#DDE4DC');
  assert.equal((await readPond(frame))[0].duration, '91s');
  await openPanel(page, 'Fish');
  await page.getByRole('switch', { name: 'Keep fish still' }).click();
  assert.equal((await readPond(frame))[0].motion, 'none');
  assert.ok(await claudeLapTime.isDisabled());

  const pond = await exportedTheme(page);
  assert.equal(pond.id, 'koi-pond');
  assert.equal(pond.variants.light.canvas, '#dde4dc');
  assert.match(pond.css, /--koi-claude-time: 91s/);
  assert.doesNotMatch(pond.css, /--koi-reflection/);
  await openPanel(page, 'Agents');
  // A finished slot can be reused and Reset clears a running simulation.
  for (let count = 0; count < 3; count++) await spawn.click();
  assert.ok(await spawn.isDisabled());
  await finish('Claude').first().click();
  assert.ok(await spawn.isEnabled());
  await spawn.click();
  assert.ok(await spawn.isDisabled());
  await reset.click();
  assert.ok(await reset.isDisabled());
  await openPanel(page, 'Fish');
  assert.equal(await page.getByRole('slider', { name: 'Claude lap time' }).getAttribute('aria-valuenow'), '72');
  assert.equal((await readPond(frame))[0].duration, '72s');
  await openPanel(page, 'Agents');
  assert.equal(await page.getByLabel('Main thread model').inputValue(), 'Claude');
  assert.equal(await frame.locator('.demo .studio-group').count(), 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal((await readPond(frame))[0].motion, 'none');
  await spawn.click();
  assert.equal((await readPond(frame)).length, 2);
  await finish('Claude').first().click();
  assert.equal((await readPond(frame)).length, 1);

  const mainModel = page.getByLabel('Main thread model');
  await mainModel.selectOption('OpenCode');
  assert.deepEqual((await readPond(frame)).map(fish => [fish.track, fish.color]), [
    ['t3-koi-opencode', '#eed6df'],
  ]);
  await mainModel.selectOption('OpenAI');
  await add('OpenCode').click();
  assert.deepEqual((await readPond(frame)).map(fish => fish.track), ['t3-koi-openai', 't3-koi-opencode']);
  await finish('OpenCode').click();
  assert.equal((await readPond(frame)).length, 1);
  await openPanel(page, 'Fish');
  await setSlider(page.getByRole('slider', { name: 'OpenCode lap time' }), 62);
  assert.match((await exportedTheme(page)).css, /--koi-opencode-time: 62s/);

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Page width " + width);
  }

  await page.getByRole('navigation').getByRole('link', { name: 'Collection' }).click();
  await page.goto(new URL('/dark-texture', site).href);
  await page.waitForURL('**/dark-texture');
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  const texturePond = frame.locator('.demo');
  await openPanel(page, 'Effects');
  const grain = page.getByRole('slider', { name: 'Grain strength' });
  await texturePond.evaluate(async pond => {
    const image = new Image();
    image.src = getComputedStyle(pond, '::before').backgroundImage.slice(5, -2);
    await image.decode();
  });
  const defaultContrast = await grainContrast(page, texturePond);
  assert.ok(defaultContrast >= 3, `Default light grain should be visible, received contrast ${defaultContrast}`);
  await setSlider(grain, 0);
  assert.equal(await grainContrast(page, texturePond), 0);
  await setSlider(grain, 100);
  assert.ok(await grainContrast(page, texturePond) > defaultContrast);

  await openPanel(page, 'Colors');
  await page.locator('input[name="light"]').fill('#dadfe8');
  assert.equal(await texturePond.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(218, 223, 232)');
  await openPanel(page, 'Effects');
  await setSlider(grain, 29);
  assert.equal(await texturePond.evaluate(el => getComputedStyle(el, '::before').opacity), '0.29');
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  assert.equal(await texturePond.evaluate(el => getComputedStyle(el, '::before').opacity), '0.29');
  assert.ok(await grainContrast(page, texturePond) > 0);
  const texture = await exportedTheme(page);
  assert.equal(texture.id, 'dark-texture');
  assert.equal(texture.variants.light.canvas, '#dadfe8');
  assert.match(texture.css, /--texture-grain: 0\.29/);
  await page.getByRole('link', { name: 'Install' }).click();
  assert.ok(await page.getByRole('heading', { name: 'Install Dark texture' }).isVisible());
  assert.ok(await page.getByText('Import a file', { exact: true }).isVisible());
  await openPanel(page, 'Colors');
  assert.equal(await page.locator('input[name="light"]').inputValue(), '#dadfe8');
  assert.deepEqual(errors, []);

  await page.route('**/downloads/koi-pond.json', route => route.abort());
  await page.goto(new URL('/koi-pond', site).href);
  const fallback = page.getByRole('link', { name: 'Download original theme' });
  await fallback.waitFor();
  assert.equal(await fallback.getAttribute('href'), '/downloads/koi-pond.json');
  assert.ok(await page.getByRole('button', { name: 'Download JSON' }).isHidden());
  await page.close();
}

async function testStandaloneGemini(browser) {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto(new URL('/koi-pond', site).href);
  const frame = page.frameLocator('.studio-viewport iframe');
  await frame.locator('.demo').waitFor();
  await openPanel(page, 'Agents');
  await page.getByLabel('Main thread model').selectOption('OpenAI');

  // T3 Code renders a single delegated task outside the grouped timeline row.
  await frame.locator('.demo').evaluate(pond => {
    const row = document.createElement('button');
    row.dataset.v2ItemType = 'subagent';
    row.setAttribute('aria-description', 'Running');
    row.innerHTML = `<span aria-hidden="true">
      <svg viewBox="0 0 128 128"><image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAQAElEQVR4nOx9CbhsVXXmWvucqst7AmpQwDmoDUgQpTtGmcRIBEHhAwxEMRpCjEOa2NoK7/"/></svg>
      <span class="bg-info"></span>
    </span>`;
    const viewport = pond.querySelector('[data-assistant-citation-viewport]');
    viewport.append(row);

    const side = document.createElement('aside');
    side.dataset.sideChatPane = 'child-thread';
    side.innerHTML = `<div data-workspace-area="conversation">
      <div data-assistant-citation-viewport>
        <span data-chat-provider-model-picker aria-label="Gemini Pro"></span>
      </div>
    </div>`;
    pond.append(side);
  });
  assert.deepEqual((await readPond(frame)).map(fish => [fish.track, fish.color]), [
    ['t3-koi-openai', '#f2f2f2'],
    ['t3-koi-gemini', '#a9d7ff'],
  ]);
  assert.deepEqual(await frame.locator('aside [data-workspace-area="conversation"]').evaluate(pond => {
    const viewport = pond.querySelector('[data-assistant-citation-viewport]');
    return [pond, viewport].flatMap(host => ['::before', '::after'].map(pseudo => getComputedStyle(host, pseudo).content));
  }), ['none', 'none', 'none', 'none']);
  await frame.locator('.demo [data-v2-item-type="subagent"]').first().evaluate(row => {
    row.setAttribute('aria-description', 'Finished');
    row.querySelector('.bg-info').className = 'bg-success';
  });
  assert.deepEqual((await readPond(frame)).map(fish => fish.track), ['t3-koi-openai']);

  // OpenCode's native logo identifies the provider even when its model name is Claude.
  await frame.locator('.preview-composer [data-chat-provider-model-picker]').evaluate(picker => {
    picker.setAttribute('aria-label', 'Claude Sonnet');
    picker.innerHTML = '<svg viewBox="0 0 32 40"><path d="M24 8H8V32H24V8ZM32 40H0V0H32V40Z"/></svg>';
  });
  assert.deepEqual((await readPond(frame)).map(fish => fish.track), ['t3-koi-opencode']);

  await page.close();
}

async function testNativeComposerGemini(browser) {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto(new URL('/koi-pond', site).href);
  const frame = page.frameLocator('.studio-viewport iframe');
  await frame.locator('.demo').waitFor();
  const picker = frame.locator('[data-chat-provider-model-picker]');
  await picker.evaluate(picker => {
    picker.setAttribute('aria-label', 'Gemini 4 Hydrogen, High');
    picker.innerHTML = `<span data-chat-provider-model-picker-icon>
      <svg viewBox="0 0 128 128"><image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAQAElEQVR4nOx9CbhsVXXmWvucqst7AmpQwDmoDUgQpTtGmcRIBEHhAwxEMRpCjEOa2NoK7/"/></svg>
    </span>`;
  });
  for (const appearance of ['Dark', 'Light']) {
    await page.getByRole('radio', { name: appearance, exact: true }).check();
    assert.deepEqual((await readPond(frame)).map(fish => [fish.track, fish.color]), [
      ['t3-koi-gemini', '#a9d7ff'],
    ]);
  }
  await picker.evaluate(button => button.setAttribute('aria-label', 'Hydrogen, High'));
  assert.equal((await readPond(frame))[0].track, 't3-koi-gemini');
  await picker.evaluate(button => {
    const composer = button.closest('[data-workspace-area="composer"]');
    const side = document.createElement('aside');
    side.dataset.sideChatPane = 'child-thread';
    const sideCanvas = document.createElement('div');
    sideCanvas.dataset.chatCanvas = 'true';
    sideCanvas.append(composer.cloneNode(true));
    side.append(sideCanvas);
    composer.parentElement.append(side);
    button.setAttribute('aria-label', 'GPT-6 Astra');
    button.replaceChildren();
  });
  assert.equal((await readPond(frame))[0].track, 't3-koi-openai');
  await page.close();
}

async function testBlockworks(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(site);
  const original = await (await page.request.get(new URL('/downloads/minecraft.json', site).href)).json();
  await page.goto(new URL('/minecraft', site).href);
  await openPanel(page, 'Effects');
  const model = page.getByLabel('Main thread model');
  const frame = page.frameLocator('.studio-viewport iframe');
  const pond = frame.locator('.demo');
  assert.equal(original.canvas, '#121316');
  assert.equal(original.variants.light.canvas, '#e8e9ec');
  const dock = frame.locator('[data-chat-composer-main-surface]');
  const look = () => dock.evaluate(el => {
    const icon = getComputedStyle(el, '::after');
    const aura = getComputedStyle(el, '::before');
    return { sprite: icon.backgroundImage, animation: icon.animationName, motion: icon.animationPlayState,
      position: icon.backgroundPositionX, anchor: icon.position, pointerEvents: icon.pointerEvents,
      width: icon.width, sizing: icon.backgroundSize, badge: aura.content, aura: aura.animationName,
      particles: aura.backgroundImage, lift: icon.getPropertyValue('--mc-lift').trim() };
  });
  const sprites = {};
  for (const provider of ['Gemini', 'Claude', 'OpenCode', 'OpenAI']) {
    await model.selectOption(provider);
    sprites[provider] = (await look()).sprite;
  }
  assert.equal(new Set(Object.values(sprites)).size, 4);
  assert.equal(await pond.evaluate(el => getComputedStyle(el, '::before').content), 'none');
  assert.equal((await look()).anchor, 'absolute');
  assert.equal((await look()).width, '64px');
  assert.equal((await look()).sizing, '400% 100%');
  assert.match((await look()).sprite, /^url\("data:image\/png;base64,/);
  assert.equal((await look()).pointerEvents, 'none');
  assert.equal((await look()).animation, 'minecraft-idle');

  const buddy = frame.getByRole('combobox', { name: 'Mob buddy' });
  await buddy.focus();
  await buddy.press('ArrowDown');
  assert.equal(await buddy.inputValue(), 'openai');
  await buddy.selectOption('claude');
  assert.equal((await look()).sprite === sprites.Claude, true);
  const savedMob = await exportedTheme(page);
  assert.match(savedMob.css, /--mc-picked-buddy: var\(--mc-claude\)/);
  for (const mob of ['creeper', 'fox']) {
    await buddy.selectOption(mob);
    assert.ok(!Object.values(sprites).includes((await look()).sprite));
  }
  await buddy.selectOption('claude');

  const activity = page.getByLabel('Preview activity');
  await activity.selectOption('Reasoning');
  assert.equal((await look()).animation, 'minecraft-thinking');
  assert.equal((await look()).position, '66.6667%');
  await activity.selectOption('Coding');
  assert.equal((await look()).animation, 'minecraft-working');
  assert.equal((await look()).position, '100%');
  const rail = frame.locator('.preview-rail');
  const studioCard = rail.locator('[aria-current="page"]');
  await rail.waitFor();
  assert.equal(await rail.evaluate(el => getComputedStyle(el).backdropFilter), 'blur(16px) saturate(1.25)');
  assert.equal(await studioCard.evaluate(el => getComputedStyle(el).animationName), 'minecraft-enchantment');
  const gear = async (modelName, expected) => {
    await model.selectOption(modelName);
    assert.equal(await dock.evaluate((el, property) =>
      getComputedStyle(el, '::after').backgroundImage ===
      getComputedStyle(el.ownerDocument.documentElement).getPropertyValue(property).trim(), expected), true);
  };
  const effort = page.getByLabel('Reasoning level');
  for (const state of ['Coding', 'Reasoning']) {
    await activity.selectOption(state);
    for (const [level, animation, lift] of [
      ['Low', 'none', '0px'], ['Medium', 'minecraft-glints', '0px'], ['High', 'minecraft-max-glints', '-4px'],
    ]) {
      await effort.selectOption(level);
      for (const [modelName, sprite] of [
        ['Claude|Haiku 4.5', '--mc-claude-fast'],
        ['Claude|Sonnet 4.6', '--mc-claude'],
        ['OpenAI|6.2 Sol Medium', '--mc-claude-heavy'],
      ]) {
        await gear(modelName, sprite);
        const visual = await look();
        assert.equal(visual.aura, animation, `${state} ${modelName} at ${level}`);
        assert.equal(visual.lift, lift);
        if (level === 'Low') assert.equal(visual.particles, 'none, none');
        else assert.match(visual.particles, /linear-gradient/);
      }
    }
  }
  assert.deepEqual(await exportedTheme(page), savedMob);
  await buddy.selectOption('auto');
  await gear('Gemini|Flash', '--mc-gemini-fast');
  await gear('Gemini', '--mc-gemini-heavy');
  await buddy.selectOption('claude');
  for (const [state, badge] of [['Approval', '!'], ['Error', '\u00d7'], ['Background', 'z']]) {
    await activity.selectOption(state);
    assert.equal((await look()).badge, JSON.stringify(badge));
  }
  await activity.selectOption('Coding');
  const still = page.getByRole('switch', { name: 'Keep the buddy still' });
  await still.click();
  assert.equal((await look()).motion, 'paused');
  await still.click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal((await look()).animation, 'none');
  assert.equal((await look()).aura, 'none');
  assert.equal(await studioCard.evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  assert.equal(await dock.evaluate(el => getComputedStyle(el, '::after').backgroundImage ===
    getComputedStyle(el.ownerDocument.documentElement).getPropertyValue('--mc-claude-heavy').trim()), true);

  await page.getByLabel('Preview conversation state').selectOption('conversation');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Page width " + width);
    assert.ok(await page.locator('.preview-toolbar').evaluate(el => el.scrollWidth <= el.clientWidth));
    const clearance = await dock.evaluate(el => {
      const icon = getComputedStyle(el, '::after');
      const aura = getComputedStyle(el, '::before');
      const decorationHeight = Math.max(parseFloat(icon.height), parseFloat(aura.height));
      const top = el.getBoundingClientRect().top - decorationHeight;
      const timeline = el.ownerDocument.querySelector('.preview-messages');
      return top - timeline.getBoundingClientRect().bottom;
    });
    assert.ok(clearance > 0, `The buddy and its effects should clear the conversation at ${width}px, got ${clearance}px`);
  }
  await page.getByRole('button', { name: 'Reset' }).click();
  assert.equal(await buddy.inputValue(), 'auto');
  assert.equal(await activity.inputValue(), 'Idle');
  assert.equal(await effort.inputValue(), 'Low');
  assert.deepEqual(await exportedTheme(page), original);
  assert.deepEqual(errors, []);
  await page.close();
}

async function testNightfall(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(site);
  const gallery = page.getByRole('article', { name: 'Nightfall' });
  const originalResponse = await page.request.get(new URL('/downloads/nightfall-christmas.json', site).href);
  assert.ok(originalResponse.ok());
  const original = await originalResponse.json();
  assert.equal(original.id, 'nightfall-christmas');
  assert.ok(original.css.length < 100000);
  await gallery.getByRole('link', { name: 'Nightfall', exact: true }).click();
  await page.waitForURL('**/nightfall-christmas');
  const frame = page.frameLocator('.studio-viewport iframe');
  const pond = frame.locator('.demo');
  const composer = frame.locator('[data-chat-composer-main-surface]');
  await composer.waitFor();
  const look = () => frame.locator('.preview-workspace').evaluate(ws => {
    const demo = ws.querySelector('.demo');
    const box = ws.querySelector('[data-chat-composer-main-surface]');
    const snow = getComputedStyle(box, '::before');
    const lights = getComputedStyle(box, '::after');
    return {
      canvas: getComputedStyle(ws.ownerDocument.body).backgroundColor,
      backdropImage: getComputedStyle(demo).backgroundImage,
      backdropBefore: getComputedStyle(demo, '::before').content,
      backdropAfter: getComputedStyle(demo, '::after').content,
      snowAnimation: getComputedStyle(demo, '::before').animationName,
      snowState: getComputedStyle(demo, '::before').animationPlayState,
      flakePointer: getComputedStyle(demo, '::before').pointerEvents,
      snowPosition: getComputedStyle(demo, '::before').backgroundPosition,
      snowSource: snow.borderImageSource,
      snowPointer: snow.pointerEvents,
      lightsSource: lights.borderImageSource,
      lightsPointer: lights.pointerEvents,
      animation: lights.animationName,
      state: lights.animationPlayState,
    };
  });
  await openPanel(page, 'Agents');
  assert.equal(await page.getByRole('button', {name:'Add Claude subagent'}).count(), 1);
  const snowmen = () => frame.locator('[data-assistant-citation-viewport]').evaluate(el => getComputedStyle(el, '::after').backgroundImage);
  assert.equal((await snowmen()).match(/data:image\/svg/g).length, 1);
  for (const provider of ['Claude', 'Gemini', 'OpenCode']) {
    await page.getByRole('button', {name: 'Add '+provider+' subagent'}).click();
  }
  assert.equal((await snowmen()).match(/data:image\/svg/g).length, 4);
  const marks = await pond.evaluate(el => ['claude','gemini','opencode'].map((p,i)=>getComputedStyle(el).getPropertyValue('--nightfall-agent-'+(i+1))));
  assert.equal(new Set(marks).size, 3);
  await page.getByRole('button', {name: 'Finish Gemini subagent'}).click();
  assert.equal((await snowmen()).match(/data:image\/svg/g).length, 3);
  await page.getByRole('button', { name: 'Reset' }).click();
  await openPanel(page, 'Effects');
  const slider = page.getByRole('slider', {name:'Snowfall intensity'});
  await slider.focus(); await slider.press('Home');
  assert.equal(await pond.evaluate(el => getComputedStyle(el,'::before').opacity), '0');
  assert.match((await exportedTheme(page)).css, /--nightfall-snow-intensity: 0/);
  const speed = page.getByRole('slider', {name:'Snowfall speed'});
  await speed.focus(); await speed.press('End');
  assert.equal(await pond.evaluate(el => getComputedStyle(el,'::before').animationDuration), '5s');
  const glow = page.getByRole('slider', {name:'Light glow'});
  await glow.focus(); await glow.press('Home');
  assert.match((await exportedTheme(page)).css, /--nightfall-light-brightness: 0/);
  await openPanel(page, 'Colors');
  await page.getByRole('textbox', {name:'Dark base hex'}).fill('#201e24');
  await openPanel(page, 'Effects');
  assert.equal((await exportedTheme(page)).colors.canvas, '#201e24');
  await page.getByRole('switch', {name:'Snow on the chat box'}).click();
  assert.match((await exportedTheme(page)).css, /--nightfall-ledge: var\(--nightfall-bare\)/);
  await page.getByRole('switch', {name:'Show snowmen'}).click();
  assert.equal(await frame.locator('[data-assistant-citation-viewport]').evaluate(el => getComputedStyle(el,'::after').opacity), '0');
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.locator('.studio-viewport').scrollIntoViewIfNeeded();
  await frame.locator('html:not([data-paused])').waitFor({ state: 'attached', timeout: 5000 });
  const dark = await look();
  assert.equal(dark.canvas, 'rgb(16, 16, 16)');
  assert.equal(dark.backdropImage, 'none');
  assert.equal(dark.backdropBefore, '""');
  assert.equal(dark.backdropAfter, '""');
  assert.match(dark.snowSource, /^url\("data:image\/webp;base64,/);
  assert.match(dark.lightsSource, /^url\("data:image\/webp;base64,/);
  assert.equal(dark.snowPointer, 'none');
  assert.equal(dark.snowAnimation, 't3-nightfall-snow');
  assert.equal(dark.flakePointer, 'none');
  await page.waitForTimeout(100);
  assert.notEqual((await look()).snowPosition, dark.snowPosition);
  assert.equal(dark.lightsPointer, 'none');
  assert.equal(dark.animation, 't3-nightfall-glow');
  assert.equal(dark.state, 'running');
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  const light = await look();
  assert.equal(light.canvas, 'rgb(221, 230, 238)');
  assert.notEqual(light.snowSource, dark.snowSource);
  await page.getByRole('switch', { name: 'Pause snow and lights' }).click();
  assert.equal((await look()).state, 'paused');
  assert.equal((await look()).snowState, 'paused');
  assert.match((await exportedTheme(page)).css, /--theme-motion-state: paused/);
  await page.getByRole('button', { name: 'Reset' }).click();
  assert.deepEqual(await exportedTheme(page), original);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal((await look()).animation, 'none');
  assert.equal((await look()).snowAnimation, 'none');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Page width " + width);
  }
  assert.deepEqual(errors, []);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    const defaultsPage = await browser.newPage();
  await defaultsPage.goto(site);
  assert.equal(await defaultsPage.getByRole('article', { name: 'Dark texture', exact: true }).count(), 0);
  for (const name of ['Koi pond', 'Nightfall', 'Minecraft', 'Minecraft Retro']) {
    const card = defaultsPage.getByRole('article', {name, exact: true});
    const frame = card.frameLocator('iframe');
    const expectedMode = ['Nightfall', 'Minecraft Retro'].includes(name) ? 'light' : 'dark';
    assert.equal(await card.locator('.preview').getAttribute('data-preview-appearance'), expectedMode);
    const picker = frame.locator('[data-chat-provider-model-picker]');
    await picker.waitFor();
    assert.equal(await picker.textContent(), name === 'Koi pond' ? 'Opus 5.5 High' : '6.1 Sol High');
    if (name === 'Koi pond') assert.equal((await readPond(frame))[0].track, 't3-koi-claude');
  }
  await defaultsPage.close();
  await testNativeComposerGemini(browser);
    await testStudio(browser);
    await testStandaloneGemini(browser);
    await testBlockworks(browser);
    await testNightfall(browser);
    console.log('Theme studio browser checks passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
