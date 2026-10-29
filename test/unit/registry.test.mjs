import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasVersion, listVersions, parseVersions } from '../../scripts/lib/registry.mjs';
import { compareVersions, assertOidcEnvironment } from '../../scripts/lib/exec.mjs';
import { classifyFailure } from '../../scripts/lib/diagnostics.mjs';

const fakeRun = (result) => async (command, args) => {
  fakeRun.calls.push({ command, args });
  return { code: 0, stdout: '', stderr: '', signal: null, ...result };
};
fakeRun.calls = [];

test('npm view output: a single string, an array, or nothing', () => {
  assert.deepEqual(parseVersions('"1.0.0"\n'), ['1.0.0']);
  assert.deepEqual(parseVersions('["1.0.0","1.0.1"]'), ['1.0.0', '1.0.1']);
  assert.deepEqual(parseVersions(''), []);
  assert.equal(hasVersion(['1.0.0'], '1.0.0'), true);
});

test('E404 means no versions yet', async () => {
  const run = fakeRun({ code: 1, stderr: 'npm error code E404\n' });
  assert.deepEqual(await listVersions({ name: '@hagicode/new', registryUrl: 'https://r', run }), []);
  assert.deepEqual(fakeRun.calls.at(-1).args.slice(0, 2), ['view', '@hagicode/new']);
});

test('a 5xx or network error fails instead of assuming the version is absent', async () => {
  const run = fakeRun({ code: 1, stderr: 'npm error code E503\nnpm error 503 Service Unavailable\n' });
  await assert.rejects(listVersions({ name: 'pkg', registryUrl: 'https://r', run }), /registry query for pkg failed \(exit 1\)/);
});

test('successful query returns the published versions', async () => {
  const run = fakeRun({ code: 0, stdout: '["0.9.0","1.0.0"]' });
  assert.deepEqual(await listVersions({ name: 'pkg', registryUrl: 'https://r', run }), ['0.9.0', '1.0.0']);
});

test('version comparison is numeric per part', () => {
  assert.ok(compareVersions('11.10.0', '11.5.1') > 0);
  assert.ok(compareVersions('11.4.9', '11.5.1') < 0);
  assert.equal(compareVersions('11.5.1', '11.5.1'), 0);
});

test('a missing OIDC identity fails with the id-token guidance', () => {
  assert.throws(() => assertOidcEnvironment({}), /Grant "id-token: write"/);
  assert.doesNotThrow(() =>
    assertOidcEnvironment({ ACTIONS_ID_TOKEN_REQUEST_URL: 'u', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 't' }),
  );
});

test('failure classes match the spec', () => {
  assert.equal(classifyFailure('npm error code E403'), 'E403');
  assert.equal(classifyFailure('npm error code ENEEDAUTH'), 'E401');
  assert.equal(classifyFailure('something else'), 'unknown');
});
