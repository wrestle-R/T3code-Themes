import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { validateSubmission, reservedSlugs } from '../app/lib/theme-format.mjs';

const [base, head] = process.argv.slice(2);
if (![base, head].every(value => /^[a-f\d]{40}$/i.test(value || ''))) throw new Error('Pass the base and head commits.');

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const changes = git('diff', '--name-status', '-z', '--no-renames', base + '...' + head).split('\0');
const [status, file] = changes;
const match = /^next\/community\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(file || '');
if (changes.length !== 3 || status !== 'A' || !match) {
  throw new Error('A theme submission must add exactly one next/community/<slug>.json file.');
}
const [, slug] = match;
if (reservedSlugs.has(slug)) throw new Error('Choose a slug that is not already used.');
const entry = git('ls-tree', head, '--', file);
if (!entry.startsWith('100644 blob ')) throw new Error('Submit a regular JSON file.');
const size = Number(git('cat-file', '-s', head + ':' + file));
if (size > 250_000) throw new Error('Theme packages must fit within 250 KB.');
const contents = git('show', head + ':' + file);
validateSubmission(JSON.parse(contents), slug);
writeFileSync(file, contents, { flag: 'wx' });
process.stdout.write(slug + '\n');
