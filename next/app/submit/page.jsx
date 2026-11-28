import { SubmitTheme } from './submit-theme';
import { githubSession } from '../lib/github-auth';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Submit a theme',
  description: 'Submit your T3 Code theme JSON for review.',
};

export default async function SubmitPage() {
  const session = await githubSession();
  return (
    <main id="main" className="wrap submit-page">
      <header className="submit-intro">
        <h1>Submit a theme</h1>
        <p>{session ? 'Paste or upload your theme JSON to submit it for review.' : 'Sign in with GitHub to submit a theme.'}</p>
      </header>
      <SubmitTheme session={session} />
    </main>
  );
}
