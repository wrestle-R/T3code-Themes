import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { builtInThemes } from '../themes';
import { validateSubmission, slugPattern, reservedSlugs } from './theme-format.mjs';

const community = join(process.cwd(), 'community');

export async function communityTheme(slug) {
  if (!slugPattern.test(slug) || slug.length > 64 || reservedSlugs.has(slug)) return null;
  try {
    const source = await readFile(join(community, slug + '.json'), 'utf8');
    const { author, description, tags, theme } = validateSubmission(JSON.parse(source), slug);
    return {
      config: theme,
      entry: {
        slug, name: theme.name, description, studioDescription: description, appearance: theme.appearance,
        tags, author: author.name, github: 'https://github.com/' + author.github, website: author.website || '',
        defaults: {}, download: '/api/theme-files/' + slug,
      },
    };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function getCatalog() {
  const files = await readdir(community);
  const submissions = await Promise.all(files.filter(name => name.endsWith('.json')).sort().map(name => communityTheme(name.slice(0, -5))));
  return [...builtInThemes, ...submissions.filter(Boolean).map(({ entry }) => entry)];
}

export async function catalogFile(slug) {
  const builtIn = builtInThemes.find(theme => theme.slug === slug);
  if (builtIn) return readFile(join(process.cwd(), 'public', builtIn.download), 'utf8');
  const result = await communityTheme(slug);
  return result ? JSON.stringify(result.config, null, 2) + '\n' : null;
}
