import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { expectedGoldens, GOLDEN } from '../support/goldens.mjs';

// Golden files are read here, never written. test/regenerate-goldens.mjs is the only writer.
const goldens = expectedGoldens();

for (const [relative, expected] of Object.entries(goldens)) {
  test(`golden ${relative} matches what the code produces`, () => {
    const file = path.join(GOLDEN, relative);
    assert.ok(fs.existsSync(file), `missing golden file ${relative}; run npm run regenerate-goldens`);
    assert.equal(fs.readFileSync(file, 'utf8'), expected);
  });
}
