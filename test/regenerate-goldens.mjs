#!/usr/bin/env node
// Writes golden files. Refuses to run unless REGENERATE_GOLDENS=yes and --write is passed, so a
// test run can never rewrite a golden file. Review the diff before committing it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedGoldens, GOLDEN } from './support/goldens.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

if (process.env.REGENERATE_GOLDENS !== 'yes' || !process.argv.includes('--write')) {
  console.error('Refusing to write goldens. Set REGENERATE_GOLDENS=yes and pass --write to regenerate.');
  process.exit(2);
}

const goldens = expectedGoldens();
for (const [relative, content] of Object.entries(goldens)) {
  const file = path.join(GOLDEN, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log(`wrote ${path.relative(path.join(here, '..'), file)}`);
}
