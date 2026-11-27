import { catalogFile } from '../../../lib/catalog';
import { countThemeDownload } from '../../../lib/theme-stats';

export async function GET(_request, { params }) {
  const { slug } = await params;
  const body = await catalogFile(slug);
  if (!body) return new Response(null, { status: 404 });
  await countThemeDownload(slug).catch(() => {});
  return new Response(body, { headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': 'attachment; filename="' + slug + '.json"',
    'Cache-Control': 'no-store',
  } });
}
