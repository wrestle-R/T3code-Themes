'use client';

import { ArrowUpRight, GitPullRequest } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { prepareThemePackage, submissionMaxBytes } from '../lib/theme-format.mjs';

const contributor = { name: 'Contributor', github: 'contributor' };
const empty = { sourceMode: 'paste', source: '', fileSource: '', fileName: '', description: '', tags: '', website: '' };

export function SubmitTheme({ session }) {
  const [draft, setDraft] = useState(empty);
  const [error, setError] = useState('');
  const [pullRequest, setPullRequest] = useState('');
  const [permissionRequired, setPermissionRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const draftKey = session ? 'theme-submission:' + session.githubId : '';

  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (!saved) return;
      const { resume, ...previous } = JSON.parse(saved);
      const restored = { ...empty, ...previous };
      setDraft(restored);
      if (resume && session.canSubmit) {
        sessionStorage.setItem(draftKey, JSON.stringify(restored));
        submitDraft(restored);
      }
    } catch {
      // The form also works without a saved draft.
    }
  }, [draftKey, session?.canSubmit]);

  function update(fields) {
    setDraft(current => ({ ...current, ...fields }));
    setError('');
    setPullRequest('');
    setPermissionRequired(false);
  }

  async function loadFile(file) {
    if (!file) return;
    if (file.size > submissionMaxBytes) {
      setError('Choose a JSON file under 250 KB.');
      return;
    }
    try {
      update({ fileSource: await file.text(), fileName: file.name });
    } catch {
      setError('Could not read the file. Try pasting the JSON.');
    }
  }

  async function authorize() {
    setError('');
    setBusy(true);
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ ...draft, resume: true }));
      await signIn('github', { callbackUrl: '/submit' }, { scope: 'read:user public_repo' });
    } catch {
      setError('Could not save the draft or connect to GitHub. Try again.');
      setBusy(false);
    }
  }

  async function submitDraft(current) {
    setError('');
    setPermissionRequired(false);
    const fields = {
      source: current.sourceMode === 'upload' ? current.fileSource : current.source,
      description: current.description.trim(),
      tags: current.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      website: current.website.trim(),
    };
    if (!fields.source.trim()) {
      setError(current.sourceMode === 'upload' ? 'Choose or drop a JSON file.' : 'Paste your theme JSON.');
      return;
    }
    try {
      prepareThemePackage(fields, contributor);
    } catch (validation) {
      setError(validation.message);
      return;
    }

    setBusy(true);
    try {
      const send = () => fetch('/api/theme-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      let response = await send();
      for (let attempt = 0; response.status === 202 && attempt < 2; attempt++) {
        await response.body?.cancel();
        await new Promise(resolve => setTimeout(resolve, 1200));
        response = await send();
      }
      const result = await response.json();
      if (result.needsPermission) setPermissionRequired(true);
      else if (result.pullRequest) {
        setPullRequest(result.pullRequest);
        try {
          sessionStorage.removeItem(draftKey);
        } catch {
          // The pull request is already open.
        }
      } else setError(result.error);
    } catch {
      setError('Could not submit the theme. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!session) return null;

  return (
    <div className="submit-layout">
      <form className="submit-form" onSubmit={event => {
        event.preventDefault();
        submitDraft(draft);
      }}>
        <fieldset className="submit-source">
          <legend>Theme JSON</legend>
          <div className="submit-source-options">
            <button type="button" aria-pressed={draft.sourceMode === 'paste'} onClick={() => update({ sourceMode: 'paste' })}>Paste JSON</button>
            <button type="button" aria-pressed={draft.sourceMode === 'upload'} onClick={() => update({ sourceMode: 'upload' })}>Upload file</button>
          </div>
          {draft.sourceMode === 'paste' ? (
            <textarea aria-label="Theme JSON" name="source" rows={8} required spellCheck={false} placeholder="Paste your T3 Code theme JSON here"
              value={draft.source} onChange={event => update({ source: event.target.value })} />
          ) : (
            <div className="submit-drop" onDragOver={event => event.preventDefault()} onDrop={event => {
              event.preventDefault();
              loadFile(event.dataTransfer.files[0]);
            }}>
              <label className="open-theme">
                Choose JSON file
                <input className="sr-only" type="file" accept=".json,application/json" onChange={event => {
                  loadFile(event.target.files[0]);
                  event.target.value = '';
                }} />
              </label>
              <span role="status">{draft.fileName || 'or drop it here'}</span>
            </div>
          )}
        </fieldset>
        <label>Description<textarea name="description" rows={3} required maxLength={180}
          value={draft.description} onChange={event => update({ description: event.target.value })} /></label>
        <label>Tags<input name="tags" required maxLength={130} placeholder="Animated, Pixel art"
          value={draft.tags} onChange={event => update({ tags: event.target.value })} /></label>
        <label><span>Personal website <small>(optional)</small></span>
          <input name="website" type="url" maxLength={200} value={draft.website}
            onChange={event => update({ website: event.target.value })} />
        </label>
        {error && <p role="alert">{error}</p>}
        {permissionRequired && (
          <div className="submit-permission">
            <p className="submit-note">GitHub asks for public repository access so the gallery can open a pull request as you. Your draft will be here when you return.</p>
            <button type="button" className="open-theme" disabled={busy} onClick={authorize}>Authorize GitHub and submit</button>
          </div>
        )}
        <div className="submit-actions">
          {pullRequest ? (
            <a className="download" href={pullRequest}>View pull request <ArrowUpRight size={15} aria-hidden="true" /></a>
          ) : (
            <button type="submit" className="download" disabled={busy || permissionRequired}>
              {busy ? 'Working…' : 'Validate and open pull request'}
            </button>
          )}
        </div>
      </form>
      <aside className="submit-pr">
        <GitPullRequest size={20} aria-hidden="true" />
        <h2>Theme review</h2>
        <p>The form checks your JSON before opening a pull request under your GitHub account. GitHub Actions then tests the gallery and studio downloads.</p>
        <a className="text-link" href="https://github.com/wrestle-R/T3code-Themes/blob/main/CONTRIBUTING.md">Read the contribution guide <ArrowUpRight size={15} aria-hidden="true" /></a>
      </aside>
    </div>
  );
}
