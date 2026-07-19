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

const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
for (const [label, version] of [
  ['package-lock.json root', lock.version],
  ['package-lock.json packages[""]', lock.packages?.['']?.version],
]) {
  if (version !== expected) {
    throw new Error(`${label} has version ${version ?? '(missing)'}; expected ${expected}`);
  }
}

const productionEnvironment = await readFile(
  new URL('../.env.production.example', import.meta.url),
  'utf8',
);
const environmentVersion = productionEnvironment.match(/^APP_VERSION=(.+)$/m)?.[1]?.trim();
if (environmentVersion !== expected) {
  throw new Error(
    `.env.production.example has APP_VERSION=${environmentVersion ?? '(missing)'}; expected ${expected}`,
  );
}

const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
if (!changelog.includes(`## ${expected} - `)) {
  throw new Error(`CHANGELOG.md does not contain a ${expected} release heading.`);
}

process.stdout.write(`Release version ${expected} matches all release metadata.\n`);
