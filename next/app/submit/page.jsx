import { SubmitTheme } from './submit-theme';

export const metadata = {
  title: 'Submit a theme',
  description: 'Send your T3 Code theme for review or add it with a pull request.',
};

export default function SubmitPage() {
  return (
    <main id="main" className="wrap submit-page">
      <header className="submit-intro">
        <h1>Submit a theme</h1>
        <p>Send a GitHub link to your theme or open a pull request to add it to the collection.</p>
      </header>
      <SubmitTheme />
    </main>
  );
}
