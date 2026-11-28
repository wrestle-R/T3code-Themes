import Link from 'next/link';
import { ArrowDown } from 'lucide-react';
import { getCatalog } from './lib/catalog';
import { ThemeGallery } from './components/theme-gallery';

export default async function Collection() {
  const catalog = (await getCatalog()).filter(theme => theme.listed !== false);
  return (
    <main id="main">
      <section id="themes" className="gallery wrap" aria-labelledby="gallery-title">
        <header className="collection-bar">
          <div>
            <h1 id="gallery-title">Themes for T3 Code</h1>
            <p>Live themes for your workspace, from swimming koi to roaming mobs.</p>
          </div>
          <a className="text-link" href="#install">How to install <ArrowDown size={15} aria-hidden="true" /></a>
        </header>
        <ThemeGallery catalog={catalog} />
      </section>

      <section id="install" className="install wrap" aria-labelledby="install-title">
        <h2 id="install-title">Install a theme</h2>
        <ol className="install-steps">
          <li><strong>Download</strong><span>Get the JSON for any theme, or customize it and download your version.</span></li>
          <li><strong>Import</strong><span>In T3 Code, go to <b>Settings → Appearance</b> and choose <b>Import a file</b>.</span></li>
          <li><strong>Apply</strong><span>Open your JSON and select the theme in the picker.</span></li>
        </ol>
        <p className="install-note">Switch between Light and Dark in <strong>Settings → Appearance</strong>.</p>
      </section>

      <section id="about" className="about wrap" aria-labelledby="about-title">
        <h2 id="about-title">Share a theme</h2>
        <p>Made a theme you’d like to share? <Link href="/submit">Submit your theme JSON</Link> for review.</p>
      </section>
    </main>
  );
}
