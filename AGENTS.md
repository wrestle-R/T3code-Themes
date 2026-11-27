# Theme contribution instructions

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the package format and check commands.

For a new community theme, add only `next/community/<slug>.json`. Keep the slug unique, include author metadata and tags, and embed assets in the theme’s CSS. The catalog, preview and download routes discover new theme packages automatically.

Build and run the production app from `next/` and run `CONTRIBUTION_SLUG=<slug> npm run test:contribution` before opening a theme PR. Describe the theme and report what you tested.
