const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { encode } = require('next-auth/jwt');
const { chromium, firefox } = require('playwright');
const { site, waitForApp } = require('./test-server.cjs');

async function signInAsTestUser(page, githubId = '900000001', canSubmit = false) {
  const secret = process.env.NEXTAUTH_SECRET;
  assert.ok(secret, 'Set the local test auth environment described in CONTRIBUTING.md.');
  const secure = new URL(site).protocol === 'https:';
  await page.context().addCookies([{
    name: (secure ? '__Secure-' : '') + 'next-auth.session-token',
    value: await encode({ secret, token: {
      githubId, ...(canSubmit && { submissionToken: 'test-public-repo-token', submissionExpires: Date.now() + 60_000 }),
    } }),
    url: site,
    httpOnly: true,
    secure,
  }]);
}

async function main() {
  await waitForApp();
  const browser = process.env.THEME_TEST_BROWSER === 'firefox'
    ? await firefox.launch()
    : await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  try {
    const page = await browser.newPage();
    // Reproduce the production report where an iframe stylesheet failed to load.
    await page.route('**/preview.css', route => route.abort());
    await page.goto(new URL('/submit', site).href);
    const layout = await page.evaluate(() => {
      const header = document.querySelector('.site-header').getBoundingClientRect();
      const footer = document.querySelector('.site-footer').getBoundingClientRect();
      return { top: header.top, bottomGap: innerHeight - footer.bottom, leftGap: footer.left - header.left, rightGap: footer.right - header.right };
    });
    assert.deepEqual(layout, { top: 0, bottomGap: 0, leftGap: 0, rightGap: 0 });
    await page.goto(site);
    const statsURL = new URL('/api/theme-stats', site);
    const rejected = await page.request.post(statsURL.href, {
      headers: { Origin: statsURL.origin, Cookie: 'theme-visitor=00000000-0000-4000-8000-000000000000' },
      data: { slug: 'minecraft-retro', liked: true, githubId: '900000001' },
    });
    assert.equal(rejected.status(), 401);
    const signIn = page.getByRole('button', { name: 'Sign in with GitHub', exact: true });
    await signIn.waitFor();
    await page.route('https://github.com/login/oauth/authorize?**', route => route.fulfill({ body: 'GitHub OAuth screen' }));
    const authorization = page.waitForRequest(request => request.url().startsWith('https://github.com/login/oauth/authorize?'));
    await signIn.click();
    const authorizeURL = new URL((await authorization).url());
    assert.equal(authorizeURL.searchParams.get('redirect_uri'), new URL('/api/auth/callback/github', site).href);
    assert.equal(authorizeURL.searchParams.get('scope'), 'read:user');
    assert.equal(authorizeURL.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(authorizeURL.searchParams.get('state'));
    await page.waitForURL(authorizeURL.href);
    await signInAsTestUser(page);
    await page.goto(site);
    assert.equal(await page.getByRole('article', { name: 'Dark texture' }).count(), 0);
    assert.equal(await page.getByRole('contentinfo').getByRole('link', { name: 'Russel' }).getAttribute('href'), 'https://russel.is-a.dev');
    assert.equal(await page.getByRole('heading', { name: 'Margin Notes' }).count(), 0);
    const retro = page.getByRole('article', { name: 'Minecraft Retro', exact: true });
    const minecraft = page.getByRole('article', { name: 'Minecraft', exact: true });
    assert.ok(await minecraft.getByRole('link', { name: 'Hike-12' }).isVisible());
    const koi = page.getByRole('article', { name: 'Koi pond', exact: true });
    assert.equal(await koi.getByRole('link', { name: 'Russel', exact: true }).getAttribute('href'), 'https://github.com/wrestle-R');
    const like = retro.getByRole('button', { name: 'Like Minecraft Retro' });
    await retro.locator('button[aria-label="Like Minecraft Retro"]:enabled').waitFor();
    const startingLikes = (await like.textContent()).trim();
    let finishLike;
    const likeRequest = new Promise(resolve => { finishLike = resolve; });
    const statsPath = '**/api/theme-stats';
    const rejectLike = async route => {
      await likeRequest;
      await route.fulfill({ status: 503 });
    };
    await page.route(statsPath, rejectLike, { times: 1 });
    await like.click();
    assert.equal(await like.getAttribute('aria-pressed'), 'true');
    assert.equal((await like.textContent()).trim(), String(Number(startingLikes) + 1));
    finishLike();
    await page.getByRole('status').filter({ hasText: 'Could not save your like.' }).waitFor();
    assert.equal(await like.getAttribute('aria-pressed'), 'false');
    assert.equal((await like.textContent()).trim(), startingLikes);

    const savedLike = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/theme-stats'));
    await like.click();
    assert.ok((await savedLike).ok());
    await page.getByRole('article').first().getByRole('heading', { name: 'Koi pond' }).waitFor();
    assert.equal(await like.getAttribute('aria-pressed'), 'true');
    await page.reload();
    await retro.getByRole('button', { name: 'Like Minecraft Retro', pressed: true }).waitFor();
    const otherVisitor = await browser.newPage();
    await otherVisitor.goto(site);
    const otherLike = otherVisitor.getByRole('button', { name: 'Sign in with GitHub to like Minecraft Retro', exact: true });
    await retro.locator('button[aria-label="Like Minecraft Retro"]:enabled[aria-pressed="true"]').waitFor();
    await otherLike.and(otherVisitor.locator('button:enabled')).waitFor();
    assert.equal((await otherLike.textContent()).trim(), String(Number(startingLikes) + 1));
    await signInAsTestUser(otherVisitor);
    await otherVisitor.reload();
    await otherVisitor.getByRole('button', { name: 'Like Minecraft Retro', pressed: true }).waitFor();
    await otherVisitor.close();
    const savedUnlike = page.waitForResponse(response => response.request().method() === 'POST' && response.url() === statsURL.href);
    await like.click();
    assert.ok((await savedUnlike).ok());
    await retro.getByRole('button', { name: 'Like Minecraft Retro', pressed: false }).waitFor();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await signIn.waitFor();
    assert.equal(await page.getByRole('navigation').getByRole('link', { name: 'My themes' }).count(), 0);
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
    await page.getByText('Sidebar', { exact: true }).click();
    await page.getByRole('button', { name: 'Fish', exact: true }).click();
    await page.getByRole('slider', { name: 'Claude lap time' }).waitFor();
    assert.equal(await page.getByRole('searchbox', { name: 'Find a color' }).isVisible(), false);
    await page.getByRole('button', { name: 'Agents', exact: true }).click();
    await page.getByRole('button', { name: 'Add Claude subagent' }).click();
    await frame.getByRole('button', { name: '1 subagent' }).waitFor();
    await page.getByRole('button', { name: 'Colors', exact: true }).click();
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
    const legacyAccounts = [
      ['143933715', 'Virar Fast'],
      ['160257872', 'Minecraft'],
      ['107079652', 'Minecraft'],
    ];
    for (const [id, title] of legacyAccounts) {
      const authorPage = await browser.newPage();
      await signInAsTestUser(authorPage, id);
      await authorPage.goto(site);
      await authorPage.getByRole('navigation').getByRole('link', { name: 'My themes' }).click();
      await authorPage.getByRole('heading', { name: 'My themes', exact: true }).waitFor();
      await authorPage.getByRole('heading', { name: title, exact: true }).waitFor();
      assert.equal(await authorPage.getByRole('article').count(), 1);
      await authorPage.close();
    }
    await signInAsTestUser(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Submit' }).click();
    const theme = JSON.stringify({ version: 1, id: 'plum-workspace', name: 'Plum workspace', appearance: 'dark', canvas: '#19151c', accent: '#dbacf6' });
    const themeJSON = page.getByRole('textbox', { name: 'Theme JSON' });
    const submit = page.getByRole('button', { name: 'Validate and open pull request' });
    await themeJSON.fill('{');
    await page.getByLabel('Description').fill('A plum theme with a quieter sidebar.');
    await page.getByLabel('Tags', { exact: true }).fill('Dark, Minimal');
    await submit.click();
    await page.getByRole('alert').getByText('The theme file is not valid JSON.').waitFor();
    await themeJSON.fill(theme);
    await submit.click();
    await page.getByRole('button', { name: 'Authorize GitHub and submit' }).waitFor();
    await page.getByRole('button', { name: 'Upload file', exact: true }).click();
    assert.equal(await themeJSON.count(), 0);
    await submit.click();
    await page.getByRole('alert').getByText('Choose or drop a JSON file.').waitFor();
    await page.getByLabel('Choose JSON file', { exact: true }).setInputFiles({
      name: 'plum-workspace.json', mimeType: 'application/json', buffer: Buffer.from(theme),
    });
    await page.getByLabel('Tags', { exact: true }).fill('Dark, Dark');
    await submit.click();
    await page.getByRole('alert').getByText('Supply 1–5 unique tags', { exact: false }).waitFor();
    await page.getByLabel('Tags', { exact: true }).fill('Dark, Minimal');
    await submit.click();
    const authorize = page.getByRole('button', { name: 'Authorize GitHub and submit' });
    await authorize.waitFor();
    await page.route('https://github.com/login/oauth/authorize?**', async route => {
      await signInAsTestUser(page, '900000001', true);
      await route.fulfill({ status: 302, headers: { location: new URL('/submit', site).href } });
    });
    const submitPath = '**/api/theme-submissions';
    const pullRequest = 'https://github.com/wrestle-R/T3code-Themes/pull/123';
    await page.route(submitPath, route => route.fulfill({ status: 201, json: { pullRequest } }));
    await page.route(submitPath, route => route.fulfill({ status: 202, json: { error: 'Fork is preparing.' } }), { times: 1 });
    const consent = page.waitForRequest(request => request.url().startsWith('https://github.com/login/oauth/authorize?'));
    const submission = page.waitForRequest(request => request.url().endsWith('/api/theme-submissions'));
    await authorize.click();
    assert.equal(new URL((await consent).url()).searchParams.get('scope'), 'read:user public_repo');
    assert.deepEqual((await submission).postDataJSON(), {
      source: theme, tags: ['Dark', 'Minimal'], description: 'A plum theme with a quieter sidebar.', website: '',
    });
    assert.equal(await themeJSON.count(), 0);
    await page.getByRole('status').getByText('plum-workspace.json').waitFor();
    assert.equal(await page.getByRole('link', { name: 'View pull request' }).getAttribute('href'), pullRequest);

    const studios = ['/koi-pond', '/dark-texture', '/nightfall-christmas', '/minecraft', '/minecraft-retro'];
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/', ...studios, '/submit', '/my-themes']) {
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
        if (path === '/koi-pond') {
          await page.getByRole('button', { name: 'Agents', exact: true }).click();
          await page.getByRole('button', { name: 'Add Gemini subagent' }).click();
          const working = preview.getByRole('button', { name: '1 subagent' });
          assert.ok(await working.evaluate(el => {
            const badge = el.getBoundingClientRect();
            const timeline = el.ownerDocument.querySelector('.preview-messages').getBoundingClientRect();
            const composer = el.ownerDocument.querySelector('.composer').getBoundingClientRect();
            return badge.top >= timeline.bottom && badge.bottom <= composer.top;
          }), 'Koi agent status sits between the conversation and composer at ' + width + 'px');
        }
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
