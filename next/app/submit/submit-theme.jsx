'use client';

import { ArrowUpRight, GitPullRequest, UserRound } from 'lucide-react';
import { useRef, useState } from 'react';

const repository = 'https://github.com/wrestle-R/T3code-Themes';
const loginPattern = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
const initialProfile = { login: '', id: '', name: '', website: '' };

function sourceDetails(value) {
  const url = new URL(value);
  const [owner, repo] = url.pathname.split('/').filter(Boolean);
  if (url.protocol !== 'https:' || url.host !== 'github.com' || !loginPattern.test(owner || '') || !repo || url.username || url.password) throw new Error();
  return { url: url.href, owner };
}

export function SubmitTheme() {
  const [source, setSource] = useState('');
  const [profile, setProfile] = useState(initialProfile);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [issueUrl, setIssueUrl] = useState('');
  const lookup = useRef(null);

  function updateProfile(field, value) {
    lookup.current?.abort();
    setStatus('');
    setIssueUrl('');
    setProfile(current => ({ ...current, [field]: value, ...(field === 'login' && { id: '' }) }));
  }

  async function detect(login) {
    lookup.current?.abort();
    if (!loginPattern.test(login)) return;
    const controller = new AbortController();
    lookup.current = controller;
    setStatus('Looking up GitHub profile…');
    try {
      const response = await fetch('/api/github-profile?login=' + encodeURIComponent(login), { signal: controller.signal });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (controller.signal.aborted) return;
      setProfile(current => ({
        login: result.login, id: result.id, name: current.name || result.name, website: current.website || result.website,
      }));
      setIssueUrl('');
      setStatus('GitHub profile filled in. You can edit the details.');
    } catch {
      if (!controller.signal.aborted) setStatus('Could not load the GitHub profile. You can enter the details below.');
    }
  }

  function detectFromSource() {
    if (profile.login) return;
    try {
      const { owner } = sourceDetails(source);
      setProfile(current => ({ ...current, login: owner }));
      detect(owner);
    } catch {
      setStatus('');
    }
  }

  function prepareIssue(event) {
    event.preventDefault();
    setError('');
    setIssueUrl('');
    const data = new FormData(event.currentTarget);
    let link;
    try {
      link = sourceDetails(source).url;
    } catch {
      setError('Enter a GitHub link to the theme file or repository.');
      return;
    }
    const tags = String(data.get('tags')).split(',').map(tag => tag.trim()).filter(Boolean);
    if (tags.length < 1 || tags.length > 5 || tags.some(tag => tag.length > 24) || new Set(tags.map(tag => tag.toLowerCase())).size !== tags.length) {
      setError('Enter 1–5 unique tags of up to 24 characters each, separated by commas.');
      return;
    }
    if (profile.website && (!URL.canParse(profile.website) || !['http:', 'https:'].includes(new URL(profile.website).protocol))) {
      setError('Enter a website that starts with https:// or http://.');
      return;
    }
    const fields = [
      ['Theme source', link], ['GitHub username', profile.login], ['GitHub ID', profile.id],
      ['Author', profile.name.trim()], ['Website', profile.website], ['Tags', tags.join(', ')],
      ['Description', String(data.get('description')).trim()],
    ];
    if (!String(data.get('themeName')).trim() || !profile.name.trim() || !String(data.get('description')).trim()) {
      setError('Enter a theme name, author name, and description.');
      return;
    }
    const query = new URLSearchParams({
      title: 'Theme submission · ' + String(data.get('themeName')).trim(),
      body: fields.filter(([, value]) => value).map(([label, value]) => '### ' + label + '\n\n' + value).join('\n\n'),
    });
    setIssueUrl(repository + '/issues/new?' + query);
  }

  return (
    <div className="submit-layout">
      <form className="submit-form" onSubmit={prepareIssue} onChange={() => setIssueUrl('')}>
        <label>Theme name<input name="themeName" required maxLength={80} /></label>
        <label>GitHub theme link<input name="source" type="url" required maxLength={350} placeholder="https://github.com/you/your-theme" value={source} onChange={event => setSource(event.target.value)} onBlur={detectFromSource} /></label>
        <div className="submit-profile">
          <label>GitHub username<input name="github" required pattern="[A-Za-z0-9][A-Za-z0-9\\-]{0,38}" value={profile.login} onChange={event => updateProfile('login', event.target.value)} /></label>
          <button type="button" className="open-theme" onClick={() => detect(profile.login)} disabled={!loginPattern.test(profile.login)}><UserRound size={15} aria-hidden="true" /> Look up profile</button>
        </div>
        {status && <p className="submit-note" role="status">{status}</p>}
        <div className="submit-pair">
          <label>Author name<input name="name" required maxLength={80} value={profile.name} onChange={event => updateProfile('name', event.target.value)} /></label>
          <label>GitHub ID<input name="id" inputMode="numeric" pattern="[0-9]*" maxLength={20} value={profile.id} onChange={event => updateProfile('id', event.target.value)} /></label>
        </div>
        <label><span className="submit-label">Personal website <small>(optional)</small></span><input name="website" type="url" maxLength={200} value={profile.website} onChange={event => updateProfile('website', event.target.value)} /></label>
        <label>Tags<input name="tags" required maxLength={130} placeholder="Animated, Pixel art" /></label>
        <label>Description<textarea name="description" rows={3} required maxLength={180} /></label>
        {error && <p role="alert">{error}</p>}
        <div className="submit-actions">
          <button type="submit" className={issueUrl ? 'open-theme' : 'download'}>Prepare submission</button>
          {issueUrl && <a className="download" href={issueUrl}>Continue on GitHub <ArrowUpRight size={15} aria-hidden="true" /></a>}
        </div>
        {issueUrl && <p className="submit-note" role="status">Review and post the issue on GitHub to send your submission.</p>}
      </form>
      <aside className="submit-pr">
        <GitPullRequest size={20} aria-hidden="true" />
        <h2>Submit a pull request</h2>
        <p>Fork the repo and add one JSON file under <code>next/community/</code>. Include your tags, author details, and T3 Code theme.</p>
        <a className="text-link" href={repository + '/blob/main/CONTRIBUTING.md'}>Read the contribution guide <ArrowUpRight size={15} aria-hidden="true" /></a>
        <a className="open-theme" href={repository + '/compare'}>Open a pull request</a>
      </aside>
    </div>
  );
}
