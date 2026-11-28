'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SessionProvider, signIn, signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { AppearanceControl } from './ui';

const modeKey = 't3-themes-site-mode';

function SiteAppearance() {
  const [appearance, setAppearance] = useState(null);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const followPreference = () => {
      let saved;
      try {
        saved = window.localStorage.getItem(modeKey);
      } catch {
        // The toggle also works when storage is unavailable.
      }
      setAppearance(saved === 'dark' || (saved !== 'light' && preference.matches) ? 'dark' : 'light');
    };
    followPreference();
    preference.addEventListener('change', followPreference);
    return () => preference.removeEventListener('change', followPreference);
  }, []);

  useEffect(() => {
    if (appearance) document.documentElement.dataset.appearance = appearance;
  }, [appearance]);

  function changeAppearance(next) {
    setAppearance(next);
    try {
      window.localStorage.setItem(modeKey, next);
    } catch {
      // The current page still uses the selected appearance.
    }
  }

  return <AppearanceControl label="Site appearance" appearance={appearance} onChange={changeAppearance} compact />;
}

export function SiteNavigation({ githubSignInAvailable }) {
  return (
    <SessionProvider session={githubSignInAvailable ? undefined : null} refetchOnWindowFocus={githubSignInAvailable}>
      <Navigation githubSignInAvailable={githubSignInAvailable} />
    </SessionProvider>
  );
}

function Navigation({ githubSignInAvailable }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const signedIn = Boolean(session?.githubId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function changeSession() {
    setPending(true);
    setError('');
    try {
      if (signedIn) await signOut({ callbackUrl: '/' });
      else await signIn('github', { callbackUrl: pathname });
    } catch {
      setError('GitHub sign-in is unavailable. Try again.');
      setPending(false);
    }
  }

  return (
    <div className="site-tools">
      <nav aria-label="Main navigation">
        <Link href="/" aria-current={pathname === '/' ? 'page' : undefined}>Collection</Link>
        <Link href="/submit" aria-current={pathname === '/submit' ? 'page' : undefined}>Submit</Link>
        {signedIn && <Link href="/my-themes" aria-current={pathname === '/my-themes' ? 'page' : undefined}>My themes</Link>}
      </nav>
      {githubSignInAvailable && status !== 'loading' && (
        <button type="button" className="gallery-session site-session" disabled={pending} onClick={changeSession}>
          {/* GitHub mark from Primer Octicons */}
          <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656" />
          </svg>
          {signedIn ? 'Sign out' : 'Sign in with GitHub'}
        </button>
      )}
      {error && <span role="status">{error}</span>}
      <SiteAppearance />
    </div>
  );
}
