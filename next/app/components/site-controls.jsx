'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

export function SiteNavigation() {
  const pathname = usePathname();
  return (
    <div className="site-tools">
      <nav aria-label="Main navigation">
        <Link href="/" aria-current={pathname === '/' ? 'page' : undefined}>Collection</Link>
        <Link href="/submit" aria-current={pathname === '/submit' ? 'page' : undefined}>Submit</Link>
      </nav>
      <SiteAppearance />
    </div>
  );
}
