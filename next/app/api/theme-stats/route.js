import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { getCatalog } from '../../lib/catalog';
import { countThemeDownload, readThemeStats, setThemeLike } from '../../lib/theme-stats';

const cookieName = 'theme-visitor';
const unavailable = () => Response.json({ error: 'Theme statistics are temporarily unavailable.' }, { status: 503 });

async function visitorId() {
  const jar = await cookies();
  const existing = jar.get(cookieName)?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
  const visitor = randomUUID();
  jar.set(cookieName, visitor, { httpOnly: true, secure: Boolean(process.env.VERCEL), sameSite: 'lax', path: '/', maxAge: 31_536_000 });
  return visitor;
}

async function statistics(visitor) {
  const slugs = (await getCatalog()).map(theme => theme.slug);
  return Response.json(await readThemeStats(slugs, visitor), { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET() {
  try {
    return await statistics(await visitorId());
  } catch {
    return unavailable();
  }
}

export async function POST(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const { slug, liked, download } = (await request.json().catch(() => null)) || {};
  if (typeof liked !== 'boolean' && download !== true) return new Response(null, { status: 400 });
  if (!(await getCatalog()).some(theme => theme.slug === slug)) return new Response(null, { status: 404 });
  try {
    const visitor = await visitorId();
    if (typeof liked === 'boolean') {
      await setThemeLike(slug, visitor, liked);
      return await statistics(visitor);
    }
    await countThemeDownload(slug);
    return new Response(null, { status: 204 });
  } catch {
    return unavailable();
  }
}
