const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium, firefox } = require('playwright');
const { site, waitForApp } = require('./test-server.cjs');

async function main() {
  await waitForApp();
  const browser = process.env.THEME_TEST_BROWSER === 'firefox'
    ? await firefox.launch()
    : await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  try {
    const page = await browser.newPage();
    // Reproduce the production report where an iframe stylesheet failed to load.
    await page.route('**/preview.css', route => route.abort());
    await page.goto(site);
    assert.equal(await page.getByRole('heading', { name: 'Margin Notes' }).count(), 0);
    const retro = page.getByRole('article', { name: 'Minecraft Retro', exact: true });
    const minecraft = page.getByRole('article', { name: 'Minecraft', exact: true });
    assert.ok(await minecraft.getByRole('link', { name: 'Hike-12' }).isVisible());
    const like = retro.getByRole('button', { name: 'Like Minecraft Retro' });
    await like.click();
    await page.getByRole('article').first().getByRole('heading', { name: 'Minecraft Retro' }).waitFor();
    assert.equal(await like.getAttribute('aria-pressed'), 'true');
    await page.reload();
    await retro.getByRole('button', { name: 'Like Minecraft Retro', pressed: true }).waitFor();
    const otherVisitor = await browser.newPage();
    await otherVisitor.goto(site);
    const otherLike = otherVisitor.getByRole('button', { name: 'Like Minecraft Retro', pressed: false });
    await otherLike.waitFor();
    await otherVisitor.getByRole('article').first().getByRole('heading', { name: 'Minecraft Retro' }).waitFor();
    await otherVisitor.close();
    await like.click();
    await retro.getByRole('button', { name: 'Like Minecraft Retro', pressed: false }).waitFor();
    await page.getByRole('searchbox', { name: 'Search themes' }).fill('minecraft');
    assert.equal(await page.getByRole('article').count(), 2);
    await page.getByLabel('Filter by tag').selectOption('Voxel');
    assert.equal(await page.getByRole('article').count(), 1);

    const download = retro.getByRole('link', { name: 'Download Minecraft Retro JSON' });
    const before = Number(await download.locator('.download-count').textContent());
    const pending = page.waitForEvent('download');
    await download.click();
    const file = await pending;
    const downloaded = JSON.parse(await readFile(await file.path(), 'utf8'));
    assert.equal(downloaded.name, 'Minecraft Retro');
    await download.getByText(String(before + 1), { exact: true }).waitFor();

    await page.goto(new URL('/koi-pond', site).href);
    const frame = page.frameLocator('.studio-viewport iframe');
    await frame.getByRole('heading', { name: 'What should we build?' }).waitFor();
    const editorWidth = (await page.locator('.studio-viewport').boundingBox()).width;
    await page.getByRole('searchbox', { name: 'Find a color' }).fill('sidebar background');
    await page.getByLabel('Sidebar background hex', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Main text hex', { exact: true }).count(), 0);
    await page.getByRole('searchbox', { name: 'Find a color' }).clear();
    await page.getByLabel('Preview conversation state').selectOption('conversation');
    await frame.getByText('Can we make the workspace easier to scan?').waitFor();
    await page.getByLabel('Sidebar background hex', { exact: true }).fill('#345678');
    await page.getByLabel('Main text hex', { exact: true }).fill('#facade');
    assert.equal(await frame.getByRole('complementary', { name: 'Sample sidebar' }).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(52, 86, 120)');
    assert.equal(await frame.locator('.preview-messages').evaluate(el => getComputedStyle(el).color), 'rgb(250, 202, 222)');
    await page.getByRole('radio', { name: 'Light', exact: true }).check();
    await page.getByLabel('Sidebar background hex', { exact: true }).fill('#fedcba');
    const exported = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download JSON' }).click();
    const bytes = await readFile(await (await exported).path());
    const json = JSON.parse(bytes);
    assert.equal(json.variants.dark.sidebar, '#345678');
    assert.equal(json.variants.dark.text, '#facade');
    assert.equal(json.variants.light.sidebar, '#fedcba');
    await page.getByRole('button', { name: 'Reset' }).click();
    await page.getByLabel('Import theme file').setInputFiles({ name: 'koi-pond.json', mimeType: 'application/json', buffer: bytes });
    await page.getByText('Imported Koi pond.').waitFor();
    assert.equal(await frame.getByRole('complementary', { name: 'Sample sidebar' }).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(52, 86, 120)');
    await page.getByLabel('Import theme file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await page.getByText('Could not import that file.', { exact: false }).waitFor();
    assert.equal(await frame.getByRole('complementary', { name: 'Sample sidebar' }).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(52, 86, 120)');

    await page.getByRole('button', { name: 'Full preview', exact: true }).click();
    assert.ok((await page.locator('.studio-viewport').boundingBox()).width > editorWidth);
    await page.getByRole('button', { name: 'Customize', exact: true }).click();
    assert.equal((await page.locator('.studio-viewport').boundingBox()).width, editorWidth);
    await page.route('**/api/github-profile?login=test-user', route => route.fulfill({
      json: { name: 'Test Author', login: 'test-user', id: 123, website: 'https://example.org/' },
    }));
    await page.getByRole('navigation').getByRole('link', { name: 'Submit' }).click();
    await page.getByLabel('Theme name', { exact: true }).fill('Plum');
    await page.getByLabel('GitHub theme link').fill('https://github.com/test-user/plum/blob/main/plum.json');
    await page.getByLabel('Description').fill('A plum theme with a quieter sidebar.');
    await page.getByText('GitHub profile filled in.', { exact: false }).waitFor();
    assert.equal(await page.getByLabel('Author name').inputValue(), 'Test Author');
    assert.equal(await page.getByLabel('GitHub ID').inputValue(), '123');
    assert.equal(await page.getByLabel('Personal website', { exact: false }).inputValue(), 'https://example.org/');
    await page.getByLabel('Tags', { exact: true }).fill('Dark, Dark');
    await page.getByRole('button', { name: 'Prepare submission' }).click();
    await page.getByRole('alert').getByText('Enter 1–5 unique tags', { exact: false }).waitFor();
    await page.getByLabel('Tags', { exact: true }).fill('Dark, Minimal');
    await page.getByRole('button', { name: 'Prepare submission' }).click();
    const issue = new URL(await page.getByRole('link', { name: 'Continue on GitHub' }).getAttribute('href'));
    assert.equal(issue.pathname, '/wrestle-R/T3code-Themes/issues/new');
    assert.match(issue.searchParams.get('body'), /Test Author[\s\S]*Dark, Minimal/);
    assert.ok(await page.getByRole('link', { name: 'Open a pull request' }).isVisible());

    const studios = ['/koi-pond', '/dark-texture', '/nightfall-christmas', '/minecraft', '/minecraft-retro'];
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/', ...studios, '/submit']) {
        await page.goto(new URL(path, site).href);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path + ' at ' + width + 'px');
        if (path === '/') {
          for (const iframe of await page.locator('.theme iframe').all()) {
            const composer = iframe.contentFrame().locator('.preview-composer');
            assert.equal(await composer.evaluate(el => getComputedStyle(el).display), 'grid');
          }
        }
        if (!studios.includes(path)) continue;
        const preview = page.frameLocator('.studio-viewport iframe');
        await preview.getByRole('heading', { name: 'What should we build?' }).waitFor();
        const shell = preview.locator('.preview-shell');
        assert.equal(await shell.evaluate(el => getComputedStyle(el).display), 'grid', path);
        assert.match(await shell.evaluate(el => getComputedStyle(el).fontFamily), /system-ui/);
        await page.getByLabel('Preview conversation state').selectOption('conversation');
        await preview.getByText('Can we make the workspace easier to scan?').waitFor();
        await page.getByRole('radio', { name: 'Light', exact: true }).check();
        await preview.locator('html:not(.dark)').waitFor({ state: 'attached' });
        await page.getByRole('radio', { name: 'Dark', exact: true }).check();
        await preview.locator('html.dark').waitFor({ state: 'attached' });
      }
    }
    console.log('Community gallery, shared local counts, preview palettes, import/export, and submission checks passed.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
