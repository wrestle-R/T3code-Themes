import { communityTheme } from '../../../lib/catalog';

export async function GET(_request, { params }) {
  const { slug } = await params;
  const result = await communityTheme(slug);
  return result ? Response.json(result.config) : new Response(null, { status: 404 });
}
