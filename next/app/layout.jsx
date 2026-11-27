import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Image from 'next/image';
import Link from 'next/link';
import { SiteNavigation } from './components/site-controls';
import { PreviewStylesProvider } from './components/preview-styles';
import './globals.css';

export const metadata = {
  title: { default: 'Themes for T3 Code', template: '%s · T3 Code themes' },
  description: 'Browse, customize, and download animated and static themes for T3 Code.',
  icons: { icon: '/assets/mark.svg' },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default async function RootLayout({ children }) {
  const previewCss = await readFile(join(process.cwd(), 'app', 'preview-frame.css'), 'utf8');
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="site-header wrap">
          <Link className="wordmark" href="/">
            <Image src="/assets/mark.svg" width={26} height={26} alt="" unoptimized />
            <span>T3 Code themes</span>
          </Link>
          <SiteNavigation />
        </header>
        <PreviewStylesProvider css={previewCss}>{children}</PreviewStylesProvider>
        <footer className="site-footer wrap">
          <p>Made by Russel</p>
          <a className="text-link" href="https://github.com/wrestle-R/T3code-Themes">Source on GitHub <span aria-hidden="true">↗</span></a>
        </footer>
      </body>
    </html>
  );
}
