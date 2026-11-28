import Link from 'next/link';
import { ThemeGallery } from '../components/theme-gallery';
import { getCatalog } from '../lib/catalog';
import { githubSession } from '../lib/github-auth';

export const metadata = { title: 'My themes' };
export const dynamic = 'force-dynamic';

const legacyOwners = {
  'koi-pond': ['179145430'],
  'nightfall-christmas': ['179145430'],
  'minecraft-retro': ['179145430'],
  'dark-texture': ['179145430'],
  'virar-fast': ['143933715'],
  minecraft: ['160257872', '107079652'],
};

export default async function MyThemes() {
  const session = await githubSession();
  const catalog = session ? (await getCatalog()).filter(theme => {
    if (theme.listed === false) return false;
    if (legacyOwners[theme.slug]?.includes(session.githubId)) return true;
    if (theme.githubId) return theme.githubId === session.githubId;
    return session.githubLogin && theme.github?.toLowerCase() === 'https://github.com/' + session.githubLogin.toLowerCase();
  }) : [];

  return (
    <main id="main" className="gallery wrap submit-page">
      <header className="submit-intro">
        <h1>My themes</h1>
        <p>{session ? 'Your published themes in the collection.' : 'Sign in with GitHub to see your themes.'}</p>
      </header>
      {!!catalog.length && <ThemeGallery catalog={catalog} />}
      {session && !catalog.length && <p>You haven’t published a theme yet.</p>}
      {session && <Link className="open-theme my-theme-submit" href="/submit">Submit a theme</Link>}
    </main>
  );
}
