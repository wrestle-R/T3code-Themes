import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const directory = join(process.cwd(), 'local-docs');
const store = join(directory, 'theme-stats.json');
const prefix = '{t3code-themes}:v1:';
const localQueue = Symbol.for('t3code-themes.local-statistics-queue');

function redisCredentials() {
  const { KV_REST_API_URL, KV_REST_API_TOKEN, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, VERCEL } = process.env;
  if (KV_REST_API_URL && KV_REST_API_TOKEN) return { url: KV_REST_API_URL, token: KV_REST_API_TOKEN };
  if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) return { url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN };
  if (VERCEL) throw new Error('Connect Upstash Redis to the Vercel project');
  return null;
}

async function redis({ url, token }, command) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store',
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error('Theme statistics service unavailable');
  const { result, error } = await response.json();
  if (error) throw new Error('Theme statistics command failed');
  return result;
}

function local(operation) {
  const pending = (globalThis[localQueue] || Promise.resolve()).then(async () => {
    const saved = await readFile(store, 'utf8').then(JSON.parse).catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return {};
    });
    const stats = Object.assign(Object.create(null), saved);
    const result = operation(stats);
    if (result !== undefined) return result;
    await mkdir(directory, { recursive: true });
    const temporary = store + '.' + randomUUID();
    await writeFile(temporary, JSON.stringify(stats));
    await rename(temporary, store);
  });
  globalThis[localQueue] = pending.catch(() => {});
  return pending;
}

function withStartingCounts(slug, likes, downloads, liked) {
  const startingCount = slug === 'koi-pond' ? 7 : 1;
  return { likes: startingCount + likes, downloads: startingCount + downloads, liked };
}

export async function readThemeStats(slugs, visitor) {
  const credentials = redisCredentials();
  if (credentials) {
    const values = await redis(credentials, ['EVAL', `
      local values = {}
      for index = 1, #KEYS, 2 do
        table.insert(values, redis.call('SCARD', KEYS[index]))
        table.insert(values, tonumber(redis.call('GET', KEYS[index+1])) or 0)
        table.insert(values, ARGV[1] ~= '' and redis.call('SISMEMBER', KEYS[index], ARGV[1]) or 0)
      end
      return values
    `, slugs.length * 2, ...slugs.flatMap(slug => [prefix + slug + ':likes', prefix + slug + ':downloads']), visitor ?? '']);
    return Object.fromEntries(slugs.map((slug, index) => [
      slug, withStartingCounts(slug, values[index * 3], values[index * 3 + 1], Boolean(values[index * 3 + 2])),
    ]));
  }
  return local(stats => Object.fromEntries(slugs.map(slug => {
    const item = stats[slug];
    return [slug, withStartingCounts(slug, item?.likes.length ?? 0, item?.downloads ?? 0, Boolean(visitor && item?.likes.includes(visitor)))];
  })));
}

export async function setThemeLike(slug, visitor, liked) {
  const credentials = redisCredentials();
  if (credentials) return redis(credentials, [liked ? 'SADD' : 'SREM', prefix + slug + ':likes', visitor]);
  return local(stats => {
    const item = stats[slug] ??= { likes: [], downloads: 0 };
    item.likes = liked ? [...new Set([...item.likes, visitor])] : item.likes.filter(id => id !== visitor);
  });
}

export async function countThemeDownload(slug) {
  const credentials = redisCredentials();
  if (credentials) return redis(credentials, ['INCR', prefix + slug + ':downloads']);
  return local(stats => {
    const item = stats[slug] ??= { likes: [], downloads: 0 };
    item.downloads++;
  });
}
