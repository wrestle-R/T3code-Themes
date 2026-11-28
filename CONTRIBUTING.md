# Contributing a theme

Sign in with GitHub and paste or drop your T3 Code theme JSON into the [submission form](https://t3code-themes.vercel.app/submit). The form validates the theme and adds the metadata below. Authorize public repository access when prompted so the gallery can open the pull request from your GitHub account. To submit manually, fork the repository and open a pull request that adds one file at `next/community/<slug>.json`.

I started this gallery because I wanted something a bit more animated in T3 Code. I’d love to see themes with some motion, even if it’s just a small detail. Plain color-only themes are discouraged. If your theme has animated characters, I’d prefer a different character, look, or movement for each agent so I can tell them apart at a glance. Koi Pond, for example, gives Claude, OpenAI, Gemini, and OpenCode their own fish.

## Theme package

The package contains a version 1 T3 Code theme and the metadata shown in the gallery.

```json
{
  "author": { "name": "Your Name", "github": "your-github-handle", "website": "https://example.com" },
  "description": "A plum workspace with a slow pulse around the composer.",
  "tags": ["Animated", "Dark"],
  "theme": {
    "version": 1,
    "id": "plum-workspace",
    "name": "Plum workspace",
    "appearance": "dark",
    "canvas": "#19151c",
    "accent": "#dbacf6",
    "colors": { "sidebar": "#2d2033", "text": "#f6eef9" },
    "variants": { "light": { "canvas": "#fff6fd", "text": "#241827" } },
    "css": "@keyframes plum-glow { 50% { box-shadow: 0 0 12px #dbacf655; } } @media (prefers-reduced-motion: no-preference) { [data-chat-composer-main-surface] { animation: plum-glow 5s ease-in-out infinite; } }"
  }
}
```

- Match the theme ID to the lowercase filename, for example `plum-workspace.json`.
- Supply 1–5 distinct tags of up to 24 characters and a short description.
- Use your GitHub username. The website is optional.
- Keep the package under 250 KB and CSS at or below 100,000 characters. Embed CSS assets as data URLs and use assets you have permission to share.

Import your theme JSON into T3 Code to check both appearances. The gallery discovers the package automatically. Its download contains the inner theme object ready for import.

## Run the checks

From `next/`, run `npm ci`, `npx playwright install chromium`, and `npm run build`. Keep `npm run start` running in another terminal.

- For a submission, run `CONTRIBUTION_SLUG=plum-workspace npm run test:contribution`. It checks the public gallery and studio downloads in Chromium.
- For app changes, run `npm run test:community`, `npm run test:browser`, and `npm run test:minecraft`.
- For the local community test, set `NEXTAUTH_URL=http://localhost:3000` and set `NEXTAUTH_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET` to test-only values. Use the same environment for the server and the test runner. The test intercepts the GitHub redirect and uses a signed test session.
- Submission PRs use the **Theme submission** GitHub Actions job. It checks one added JSON package and runs the production download test with the base branch’s app. Other maintainer branches run **App and theme behavior**.

## Deployment

The Vercel configuration enables automatic Git deployments on `main`. PR validation runs in GitHub Actions. If repository rules are enabled, use the applicable GitHub Actions job for PR validation.

Shared likes and download counts on Vercel use a Redis REST endpoint configured with `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Local runs without Redis use an ignored file under `next/local-docs/`. Signed-in likes are tracked by GitHub account and download counts represent requests made through the gallery or editor.
