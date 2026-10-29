import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDevVersion, assertCounter, sanitizeSha, coreOf } from '../../scripts/lib/semver.mjs';
import { buildDevVersion } from '../../scripts/lib/version.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const table = JSON.parse(fs.readFileSync(path.join(here, '..', 'golden', 'g-prefix', 'table.json'), 'utf8'));

test('g-prefix golden table: every SHA input maps to its pinned component', () => {
  for (const row of table) {
    if (row.expected === null) {
      assert.throws(() => sanitizeSha(row.input), /no alphanumeric characters/, row.note);
    } else {
      assert.equal(sanitizeSha(row.input), row.expected, row.note);
    }
  }
});

test('every produced dev version passes the SemVer self-check', () => {
  for (const row of table.filter((entry) => entry.expected !== null)) {
    const version = buildDevVersion({ base: '0.4.0', run: '57', attempt: '2', rawSha: row.input });
    assert.equal(assertDevVersion(version), version);
  }
});

test('a forged all-digit, unprefixed SHA component is rejected', () => {
  assert.throws(() => assertDevVersion('1.0.0-dev.1.1.1234567'), /must carry the g prefix/);
  assert.throws(() => assertDevVersion('1.0.0-dev.1.1.0123456'), /not valid SemVer/);
  assert.equal(assertDevVersion('1.0.0-dev.1.1.g1234567'), '1.0.0-dev.1.1.g1234567');
});

test('typical dev version from the spec example', () => {
  assert.equal(
    buildDevVersion({ base: '0.3.1', run: '57', attempt: '2', rawSha: 'AB12cd9f00' }),
    '0.3.1-dev.57.2.ab12cd9',
  );
});

test('all-digit SHA from a real push is made SemVer-safe', () => {
  assert.equal(buildDevVersion({ base: '0.3.1', run: '5', attempt: '1', rawSha: '1234567abc' }), '0.3.1-dev.5.1.g1234567');
});

test('a re-run with a higher attempt produces a different version', () => {
  const first = buildDevVersion({ base: '0.3.1', run: '57', attempt: '1', rawSha: 'ab12cd9' });
  const second = buildDevVersion({ base: '0.3.1', run: '57', attempt: '2', rawSha: 'ab12cd9' });
  assert.notEqual(first, second);
});

test('unset run, attempt and SHA fall back to 0, 1 and local', () => {
  assert.equal(buildDevVersion({ base: '0.3.1', run: '0', attempt: '1', rawSha: 'local' }), '0.3.1-dev.0.1.local');
});

test('leading-zero run or attempt is rejected', () => {
  assert.throws(() => assertCounter('GITHUB_RUN_NUMBER', '01'), /without leading zeros/);
  assert.throws(() => buildDevVersion({ base: '0.3.1', run: '5', attempt: '02', rawSha: 'ab12cd9' }), /GITHUB_RUN_ATTEMPT/);
  assert.equal(assertCounter('GITHUB_RUN_ATTEMPT', '0'), '0');
});

test('coreOf drops prerelease and rejects invalid versions', () => {
  assert.equal(coreOf('0.6.1-rc.2'), '0.6.1');
  assert.throws(() => coreOf('1.2'), /not a valid SemVer/);
});
