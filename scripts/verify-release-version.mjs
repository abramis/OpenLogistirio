import { readFile } from 'node:fs/promises';

const tag = process.argv[2];
if (!tag || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
  throw new Error(`Invalid release tag: ${tag ?? '(missing)'}`);
}

const expected = tag.slice(1);
const manifests = [
  'package.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'packages/shared/package.json',
];

for (const manifest of manifests) {
  const parsed = JSON.parse(await readFile(new URL(`../${manifest}`, import.meta.url), 'utf8'));
  if (parsed.version !== expected) {
    throw new Error(`${manifest} has version ${parsed.version}; expected ${expected} from ${tag}`);
  }
}

process.stdout.write(`Release version ${expected} matches every workspace manifest.\n`);
