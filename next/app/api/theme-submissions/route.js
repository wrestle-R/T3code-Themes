import { getCatalog } from '../../lib/catalog';
import { githubSession, githubSubmissionToken } from '../../lib/github-auth';
import { GitHubRequestError, githubRequest, openThemePullRequest } from '../../lib/github-theme-pr';
import { githubLoginPattern, prepareThemePackage, submissionMaxBytes } from '../../lib/theme-format.mjs';

const failure = (error, status, details = {}) => Response.json({ error, ...details }, { status });

export async function POST(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return failure('Invalid request origin.', 403);
  const session = await githubSession();
  if (!session) return failure('Sign in with GitHub to submit a theme.', 401);

  let fields;
  try {
    const input = await request.text();
    if (Buffer.byteLength(input) > submissionMaxBytes * 2) return failure('Theme packages must fit within 250 KB.', 413);
    fields = JSON.parse(input);
    prepareThemePackage(fields, { name: 'Contributor', github: 'contributor', githubId: session.githubId });
  } catch (error) {
    return failure(error instanceof SyntaxError ? 'Send a valid theme submission.' : error.message, 400);
  }

  const token = await githubSubmissionToken(request);
  if (!token) return failure('Allow GitHub access to open a pull request from your account.', 403, { needsPermission: true });
  try {
    const profile = await githubRequest(token, '/user');
    if (String(profile.id) !== session.githubId || !githubLoginPattern.test(profile.login || '')) {
      return failure('Reconnect the GitHub account you signed in with.', 403, { needsPermission: true });
    }
    const author = { name: profile.name?.trim().slice(0, 80).trimEnd() || profile.login, github: profile.login, githubId: session.githubId };
    const prepared = prepareThemePackage(fields, author);
    if ((await getCatalog()).some(theme => theme.slug === prepared.slug)) {
      return failure('That theme ID is already in the collection. Choose a new ID in your JSON.', 409);
    }
    const pullRequest = await openThemePullRequest(token, profile.login, prepared);
    if (!pullRequest) return failure('GitHub is preparing your fork. Try again in a moment.', 202);
    return Response.json({ pullRequest }, { status: 201 });
  } catch (error) {
    if (error instanceof GitHubRequestError && error.status === 401) {
      return failure('GitHub access expired. Reconnect to submit your theme.', 403, { needsPermission: true });
    }
    return failure('GitHub could not open the pull request. Try again in a moment.', 502);
  }
}
