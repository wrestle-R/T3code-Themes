import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const directory = join(process.cwd(), 'local-docs');
const store = join(directory, 'theme-stats.json');
const prefix = '{t3code-themes}:v1:';
const localQueue = Symbol.for('t3code-themes.local-statistics-queue');

async function redis(command) {
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN, 'Content-Type': 'application/json' },
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

function useRedis() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) return true;
  if (process.env.VERCEL) throw new Error('Configure KV_REST_API_URL and KV_REST_API_TOKEN');
  return false;
}

export async function readThemeStats(slugs, visitor) {
  if (useRedis()) {
    const values = await redis(['EVAL', `
      local values = {}
      for index = 1, #KEYS, 2 do
        table.insert(values, redis.call('SCARD', KEYS[index]))
        table.insert(values, tonumber(redis.call('GET', KEYS[index+1])) or 0)
        table.insert(values, redis.call('SISMEMBER', KEYS[index], ARGV[1]))
      end
      return values
    `, slugs.length * 2, ...slugs.flatMap(slug => [prefix + slug + ':likes', prefix + slug + ':downloads']), visitor]);
    return Object.fromEntries(slugs.map((slug, index) => [slug, {
      likes: values[index * 3], downloads: values[index * 3 + 1], liked: Boolean(values[index * 3 + 2]),
    }]));
  }
  return local(stats => Object.fromEntries(slugs.map(slug => {
    const item = stats[slug];
    return [slug, { likes: item?.likes.length || 0, downloads: item?.downloads || 0, liked: item?.likes.includes(visitor) || false }];
  })));
}

export async function setThemeLike(slug, visitor, liked) {
  if (useRedis()) return redis([liked ? 'SADD' : 'SREM', prefix + slug + ':likes', visitor]);
  return local(stats => {
    const item = stats[slug] ??= { likes: [], downloads: 0 };
    item.likes = liked ? [...new Set([...item.likes, visitor])] : item.likes.filter(id => id !== visitor);
  });
}

export async function countThemeDownload(slug) {
  if (useRedis()) return redis(['INCR', prefix + slug + ':downloads']);
  return local(stats => {
    const item = stats[slug] ??= { likes: [], downloads: 0 };
    item.downloads++;
  });
}
