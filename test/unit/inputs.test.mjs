import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeList, parseInputs } from '../../scripts/lib/inputs.mjs';

test('defaults apply when no input variable is present', () => {
  const inputs = parseInputs({});
  assert.equal(inputs.mode, 'auto');
  assert.equal(inputs.nodeVersion, '24');
  assert.equal(inputs.provenance, true);
  assert.equal(inputs.installCommand, 'auto');
  assert.deepEqual(inputs.packages, ['.']);
  assert.equal(inputs.registryUrl, 'https://registry.npmjs.org');
});

test('an invalid mode lists the accepted values', () => {
  assert.throws(() => parseInputs({ INPUT_MODE: 'stable' }), /Accepted values: auto, dev, release/);
});

test('an invalid package-manager is rejected before any install', () => {
  assert.throws(() => parseInputs({ 'INPUT_PACKAGE-MANAGER': 'yarn' }), /Accepted values: auto, pnpm, npm/);
});

test('an empty command means the step is skipped', () => {
  const inputs = parseInputs({ INPUT_BUILD_COMMAND: '  ', 'INPUT_BUILD-COMMAND': '' });
  assert.equal(inputs.buildCommand, '');
});

test('newline-separated packages are normalised and keep their order', () => {
  assert.deepEqual(normalizeList('packages/core\r\n\n packages/a \npackages/b\n'), ['packages/core', 'packages/a', 'packages/b']);
  const inputs = parseInputs({ 'INPUT_PACKAGES': 'b\na\n' });
  assert.deepEqual(inputs.packages, ['b', 'a']);
});

test('booleans must be literal true or false', () => {
  assert.throws(() => parseInputs({ 'INPUT_DRY-RUN': 'yes' }), /Invalid dry-run "yes"/);
});

test('working-directory must stay inside the repository', () => {
  assert.throws(() => parseInputs({ 'INPUT_WORKING-DIRECTORY': '/etc' }), /relative path inside the repository/);
  assert.throws(() => parseInputs({ 'INPUT_WORKING-DIRECTORY': '../other' }), /relative path inside the repository/);
});

test('the registry URL must be an absolute http(s) URL', () => {
  assert.throws(() => parseInputs({ 'INPUT_REGISTRY-URL': 'registry.npmjs.org' }), /absolute http\(s\) URL/);
});

test('every default is a string that parseInputs accepts', () => {
  assert.doesNotThrow(() => parseInputs(Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [`INPUT_${k.toUpperCase()}`, v]))));
});
