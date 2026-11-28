'use client';

import Link from 'next/link';
import { ArrowUpRight, Download, Heart, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GalleryPreview } from './theme-preview';

export function ThemeGallery({ catalog }) {
  const [stats, setStats] = useState(null);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tags = [...new Set(catalog.flatMap(theme => theme.tags))].sort();
  const needle = query.trim().toLowerCase();
  const visible = catalog.filter(theme => (!tag || theme.tags.includes(tag)) &&
    [theme.name, theme.description, theme.author, ...theme.tags].some(value => value.toLowerCase().includes(needle)))
    .sort((left, right) => (stats?.[right.slug]?.likes || 0) - (stats?.[left.slug]?.likes || 0));

  async function refresh() {
    const response = await fetch('/api/theme-stats', { cache: 'no-store' });
    if (!response.ok) throw new Error('Counts are temporarily unavailable.');
    setStats(await response.json());
  }

  useEffect(() => {
    refresh().catch(() => setError('Likes and download counts are temporarily unavailable.'));
  }, []);

  async function like(slug) {
    const previous = stats[slug];
    const liked = !previous.liked;
    setBusy(true);
    setError('');
    setStats({ ...stats, [slug]: { ...previous, liked, likes: previous.likes + (liked ? 1 : -1) } });
    try {
      const response = await fetch('/api/theme-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, liked }),
      });
      if (!response.ok) throw new Error();
      setStats(await response.json());
    } catch {
      setStats(stats);
      setError('Could not save your like. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function download(event, slug) {
    event.preventDefault();
    if (busy) return;
    const previous = stats?.[slug];
    setBusy(true);
    setError('');
    if (previous) setStats({ ...stats, [slug]: { ...previous, downloads: previous.downloads + 1 } });
    try {
      const response = await fetch(event.currentTarget.href);
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = slug + '.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      await refresh().catch(() => {
        if (previous) setStats(stats);
      });
    } catch {
      if (previous) setStats(stats);
      setError('Could not download the theme. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="gallery-controls">
        <div className="gallery-filters">
          <label className="gallery-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" aria-label="Search themes" placeholder="Search themes" value={query} onChange={event => setQuery(event.target.value)} />
          </label>
          <select aria-label="Filter by tag" value={tag} onChange={event => setTag(event.target.value)}>
            <option value="">All tags</option>
            {tags.map(value => <option key={value}>{value}</option>)}
          </select>
        </div>
        <p className="gallery-order">Most liked first</p>
      </div>
      {error && <p role="status" className="gallery-error">{error}</p>}
      {!visible.length && <p className="gallery-error">No themes match. Try another search or tag.</p>}
      <div className="theme-grid">
        {visible.map(theme => {
          const { slug } = theme;
          const counts = stats?.[slug];
          return (
            <article className="theme" aria-labelledby={slug + '-title'} key={slug}>
              <GalleryPreview slug={slug} theme={theme} />
              <div className="theme-info">
                <header>
                  <Link className="theme-title" href={'/' + slug}>
                    <h2 id={slug + '-title'}>{theme.name}</h2><ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                  <p>{theme.description}</p>
                </header>
                <div className="theme-meta">
                  {theme.github ? <a href={theme.github}>{theme.author}</a> : <span>{theme.author}</span>}
                  <div className="theme-tags">{theme.tags.map(value => <button type="button" key={value} onClick={() => setTag(value)}>{value}</button>)}</div>
                </div>
              </div>
              <div className="theme-engagement">
                <button type="button" aria-pressed={Boolean(counts?.liked)} aria-label={'Like ' + theme.name}
                  disabled={!counts} aria-disabled={busy || undefined} onClick={() => { if (!busy) like(slug); }}>
                  <Heart size={16} fill={counts?.liked ? 'currentColor' : 'none'} aria-hidden="true" /> {counts?.likes ?? '–'}
                </button>
                <a href={'/api/theme-download/' + slug} download onClick={event => download(event, slug)}
                  aria-disabled={busy || undefined} aria-label={'Download ' + theme.name + ' JSON'}>
                  <Download size={16} aria-hidden="true" /> <span>Download</span><span className="download-count">{counts?.downloads ?? '–'}</span>
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
