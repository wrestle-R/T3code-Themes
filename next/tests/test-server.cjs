const { setTimeout: delay } = require('node:timers/promises');
const site = process.env.SITE_URL || 'http://localhost:3000';

async function waitForApp() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await fetch(site, { signal: AbortSignal.timeout(3000) }).catch(() => null);
    if (response?.ok) return;
    if (response) await response.body?.cancel();
    await delay(500);
  }
  throw new Error('App did not start at ' + site);
}

module.exports = { site, waitForApp };
