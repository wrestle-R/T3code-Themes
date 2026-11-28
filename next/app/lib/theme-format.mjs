const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const githubLoginPattern = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
export const submissionMaxBytes = 250_000;

function text(value, max) {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;
}

function colors(value) {
  return object(value) && Object.entries(value).every(([key, color]) =>
    /^[a-zA-Z][a-zA-Z0-9]*$/.test(key) && text(color, 160) && !/[;{}<>]/.test(color));
}

export function validateTheme(theme) {
  if (!object(theme) || theme.version !== 1 || !text(theme.id, 64) || !slugPattern.test(theme.id) || !text(theme.name, 80)) {
    throw new Error('Use a T3 Code version 1 theme with an ID and name.');
  }
  if (!['light', 'dark'].includes(theme.appearance) || !colors({ canvas: theme.canvas, accent: theme.accent })) {
    throw new Error('Set a light or dark appearance, canvas color, and accent color.');
  }
  if (theme.colors !== undefined && !colors(theme.colors)) throw new Error('Theme colors must be CSS color values.');
  if (theme.variants !== undefined && (!object(theme.variants) ||
    !Object.entries(theme.variants).every(([mode, palette]) => ['light', 'dark'].includes(mode) && colors(palette)))) {
    throw new Error('Theme variants must contain light or dark color palettes.');
  }
  if (theme.css !== undefined && (typeof theme.css !== 'string' || theme.css.length > 100_000)) {
    throw new Error('Theme CSS must be text with at most 100,000 characters.');
  }
  return { ...theme, css: theme.css || '' };
}

export function validateSubmission(submission, slug) {
  if (!object(submission) || !text(slug, 64) || !slugPattern.test(slug)) throw new Error('Use a lowercase theme slug.');
  const { author, description, tags, theme } = submission;
  if (!text(description, 180)) throw new Error('Add a description of up to 180 characters.');
  if (!object(author) || !text(author.name, 80) || !githubLoginPattern.test(author.github || '')) {
    throw new Error('Add an author name and GitHub username.');
  }
  if (author.githubId !== undefined && (typeof author.githubId !== 'string' || !/^\d{1,20}$/.test(author.githubId))) {
    throw new Error('Use a valid GitHub account ID.');
  }
  if (author.website && (!text(author.website, 200) || !URL.canParse(author.website) || !['https:', 'http:'].includes(new URL(author.website).protocol))) {
    throw new Error('Use an HTTP or HTTPS author website.');
  }
  if (!Array.isArray(tags) || tags.length < 1 || tags.length > 5 || !tags.every(tag => text(tag, 24)) ||
    new Set(tags.map(tag => tag.toLowerCase())).size !== tags.length) {
    throw new Error('Supply 1–5 unique tags of up to 24 characters each.');
  }
  const config = validateTheme(theme);
  if (config.id !== slug) throw new Error('The theme ID must match its filename.');
  if (/@import\b/i.test(config.css) || [...config.css.matchAll(/\burl\s*\(\s*["']?([^)"']*)/gi)].some(([, url]) => !url.startsWith('data:'))) {
    throw new Error('Embed CSS assets as data URLs.');
  }
  return { author, description, tags, theme: config };
}

export const reservedSlugs = new Set(['api', 'submit', 'my-themes', 'blockworks', 'margin-notes', 'koi-pond', 'minecraft', 'minecraft-retro', 'dark-texture', 'nightfall-christmas']);

export function prepareThemePackage(fields, author) {
  if (!object(fields) || typeof fields.source !== 'string') throw new Error('Paste or drop a T3 Code theme JSON file.');
  let theme;
  try {
    theme = JSON.parse(fields.source);
  } catch {
    throw new Error('The theme file is not valid JSON.');
  }
  const slug = theme?.id;
  if (reservedSlugs.has(slug)) throw new Error('That theme ID is already in use. Choose a new ID in your JSON.');
  const packageData = validateSubmission({
    author: { ...author, ...(fields.website && { website: fields.website }) },
    description: fields.description,
    tags: fields.tags,
    theme,
  }, slug);
  const content = JSON.stringify(packageData, null, 2) + '\n';
  if (new TextEncoder().encode(content).length > submissionMaxBytes) throw new Error('Theme packages must fit within 250 KB.');
  return { slug, name: packageData.theme.name, content };
}
