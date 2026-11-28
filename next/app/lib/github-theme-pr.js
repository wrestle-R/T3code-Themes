import { createHash } from 'node:crypto';

const owner = 'wrestle-R';
const repository = 'T3code-Themes';
const upstream = '/repos/' + owner + '/' + repository;
const base = 'main';

export class GitHubRequestError extends Error {
  constructor(status) {
    super('GitHub request failed.');
    this.status = status;
  }
}

export async function githubRequest(token, path, { method = 'GET', body, allowMissing = false } = {}) {
  const response = await fetch('https://api.github.com' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(6000),
  });
  if (response.status === 404 && allowMissing) return null;
  if (!response.ok) throw new GitHubRequestError(response.status);
  return response.json();
}

export async function openThemePullRequest(token, contributor, { slug, name, content }) {
  const github = (path, options) => githubRequest(token, path, options);
  const isOwner = contributor.toLowerCase() === owner.toLowerCase();
  let target = upstream;
  if (!isOwner) {
    const forkPath = '/repos/' + contributor + '/' + repository;
    let fork = await github(forkPath, { allowMissing: true });
    if (!fork) {
      const created = await github(upstream + '/forks', { method: 'POST', body: { default_branch_only: true } });
      fork = await github('/repos/' + created.full_name, { allowMissing: true });
    }
    if (!fork) return null;
    if (!fork.fork || fork.parent?.full_name.toLowerCase() !== (owner + '/' + repository).toLowerCase() ||
        fork.owner?.login.toLowerCase() !== contributor.toLowerCase()) {
      throw new Error('The GitHub repository under your account must be a fork of T3code-Themes.');
    }
    target = '/repos/' + fork.full_name;
  }

  const digest = createHash('sha256').update(content).digest('hex').slice(0, 16);
  const branch = 'theme-submission/' + slug + '-' + digest;
  const query = new URLSearchParams({ head: contributor + ':' + branch, base, state: 'all' });
  const existingPull = async () => (await github(upstream + '/pulls?' + query))[0];
  const existing = await existingPull();
  if (existing) return existing.html_url;

  const refPath = target + '/git/ref/heads/' + branch;
  if (!(await github(refPath, { allowMissing: true }))) {
    const main = await github(upstream + '/git/ref/heads/' + base);
    try {
      await github(target + '/git/refs', { method: 'POST', body: { ref: 'refs/heads/' + branch, sha: main.object.sha } });
    } catch (error) {
      if (error.status !== 422 || !(await github(refPath, { allowMissing: true }))) throw error;
    }
  }

  const path = '/contents/next/community/' + slug + '.json';
  const blob = await github(target + path + '?ref=' + encodeURIComponent(branch), { allowMissing: true });
  const bytes = Buffer.from(content);
  const expectedSha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  if (blob && blob.sha !== expectedSha) throw new Error('A different theme already exists on the submission branch.');
  if (!blob) {
    try {
      await github(target + path, { method: 'PUT', body: {
        branch, message: 'Add ' + name + ' theme', content: bytes.toString('base64'),
      } });
    } catch (error) {
      if (![409, 422].includes(error.status)) throw error;
      const concurrent = await github(target + path + '?ref=' + encodeURIComponent(branch), { allowMissing: true });
      if (concurrent?.sha !== expectedSha) throw error;
    }
  }

  try {
    const pull = await github(upstream + '/pulls', { method: 'POST', body: {
      title: 'Add ' + name + ' theme', head: contributor + ':' + branch, base,
      body: 'Adds `next/community/' + slug + '.json` via the T3 Code themes submission form.',
    } });
    return pull.html_url;
  } catch (error) {
    if (error.status !== 422) throw error;
    const concurrent = await existingPull();
    if (concurrent) return concurrent.html_url;
    throw error;
  }
}
