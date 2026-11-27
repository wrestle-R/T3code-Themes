export async function GET(request) {
  const login = new URL(request.url).searchParams.get('login') || '';
  if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(login)) return new Response(null, { status: 400 });
  try {
    const response = await fetch('https://api.github.com/users/' + login, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 404) return new Response(null, { status: 404 });
    if (!response.ok) throw new Error();
    const profile = await response.json();
    const blog = profile.blog?.trim();
    const website = blog ? (blog.includes('://') ? blog : 'https://' + blog) : '';
    const validWebsite = URL.canParse(website) && ['http:', 'https:'].includes(new URL(website).protocol);
    return Response.json({ login: profile.login, id: profile.id, name: profile.name || profile.login, website: validWebsite ? website : '' });
  } catch {
    return new Response(null, { status: 503 });
  }
}
