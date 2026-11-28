import { getCatalog } from '../../lib/catalog';
import { githubLikeIdentity, githubSignInAvailable } from '../../lib/github-auth';
import { countThemeDownload, readThemeStats, setThemeLike } from '../../lib/theme-stats';

const unavailable = () => Response.json({ error: 'Theme statistics are temporarily unavailable.' }, { status: 503 });

async function statistics(visitor) {
  const slugs = (await getCatalog()).map(theme => theme.slug);
  return Response.json(await readThemeStats(slugs, visitor), { headers: {
    'Cache-Control': 'private, no-store',
    'X-Theme-Likes-Auth': visitor ? 'signed-in' : githubSignInAvailable ? 'sign-in' : 'unavailable',
  } });
}

export async function GET() {
  try {
    return await statistics(await githubLikeIdentity());
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
    if (typeof liked === 'boolean') {
      const visitor = await githubLikeIdentity();
      if (!visitor) return new Response(null, { status: 401 });
      await setThemeLike(slug, visitor, liked);
      return await statistics(visitor);
    }
    await countThemeDownload(slug);
    return new Response(null, { status: 204 });
  } catch {
    return unavailable();
  }
}
