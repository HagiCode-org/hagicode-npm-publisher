import { test } from 'node:test';
import assert from 'node:assert/strict';
import { floatingTagFor } from '../../scripts/lib/tags.mjs';

test('a stable tag that is the highest of its major moves the floating major tag', () => {
  assert.equal(floatingTagFor('v1.3.0', ['v1.2.9', 'v1.0.0']), 'v1');
  assert.equal(floatingTagFor('v1.0.0', []), 'v1');
});

test('an older patch does not move the floating tag back', () => {
  assert.equal(floatingTagFor('v1.2.5', ['v1.3.0']), null);
});

test('prerelease and non-semver tags never move the floating tag', () => {
  assert.equal(floatingTagFor('v1.4.0-rc.1', ['v1.3.0']), null);
  assert.equal(floatingTagFor('release-2026', []), null);
  assert.equal(floatingTagFor('', []), null);
});

test('a new major starts its own floating tag', () => {
  assert.equal(floatingTagFor('v2.0.0', ['v1.9.9']), 'v2');
});

test('comparison is numeric: v1.10.0 beats v1.9.0', () => {
  assert.equal(floatingTagFor('v1.10.0', ['v1.9.0']), 'v1');
  assert.equal(floatingTagFor('v1.9.0', ['v1.10.0']), null);
});
