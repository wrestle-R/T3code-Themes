const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require('playwright');
const { site, waitForApp } = require('./test-server.cjs');

async function readDownload(page, action, filename) {
  const pending = page.waitForEvent('download');
  await action.click();
  const download = await pending;
  assert.equal(download.suggestedFilename(), filename);
  return JSON.parse(await readFile(await download.path(), 'utf8'));
}

async function main() {
  const slug = process.env.CONTRIBUTION_SLUG;
  assert.match(slug || '', /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const { theme, tags } = JSON.parse(await readFile('community/' + slug + '.json', 'utf8'));
  const expected = { ...theme, css: theme.css || '' };
  await waitForApp();
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  try {
    const page = await browser.newPage();
    await page.goto(site);
    const card = page.getByRole('article').filter({ has: page.locator('h2[id="' + slug + '-title"]') });
    await card.getByRole('heading', { name: theme.name, exact: true }).waitFor();
    for (const tag of tags) await card.getByRole('button', { name: tag, exact: true }).waitFor();
    assert.deepEqual(await readDownload(page, card.getByRole('link', { name: 'Download ' + theme.name + ' JSON' }), slug + '.json'), expected);
    await card.getByRole('link', { name: theme.name, exact: true }).click();
    await page.waitForURL('**/' + slug);
    await page.locator('.preview[aria-busy=false]').waitFor();
    assert.deepEqual(await readDownload(page, page.getByRole('button', { name: 'Download JSON' }), slug + '.json'), expected);
    console.log('Contributed theme appeared in the gallery and downloaded valid JSON from both entry points.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
