# Contributing a theme

Use the [submission form](https://t3code-themes.vercel.app/submit) to prepare a GitHub issue with a link to your theme. Post the issue on GitHub to send it for review. For a direct contribution, fork the repository and open a pull request that adds one file at `next/community/<slug>.json`.

The package contains a version 1 T3 Code theme and the metadata shown in the gallery.

```json
{
  "author": { "name": "Your Name", "github": "your-github-handle", "website": "https://example.com" },
  "description": "A quiet workspace with a plum sidebar.",
  "tags": ["Minimal", "Dark"],
  "theme": {
    "version": 1,
    "id": "plum-workspace",
    "name": "Plum workspace",
    "appearance": "dark",
    "canvas": "#19151c",
    "accent": "#dbacf6",
    "colors": { "sidebar": "#2d2033", "text": "#f6eef9" },
    "variants": { "light": { "canvas": "#fff6fd", "text": "#241827" } },
    "css": ""
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
- Fork PRs use the **Theme submission** GitHub Actions job. It checks one added JSON package and runs the production download test with the base branch’s app. Maintainer branches run **App and theme behavior**.

## Deployment

The Vercel configuration enables automatic Git deployments on `main`. PR validation runs in GitHub Actions. If repository rules are enabled, use the applicable GitHub Actions job for PR validation.

Shared likes and download counts on Vercel use a Redis REST endpoint configured with `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Local runs without Redis use an ignored file under `next/local-docs/`. Like counts are per browser, and download counts represent download requests made through the gallery or editor.
