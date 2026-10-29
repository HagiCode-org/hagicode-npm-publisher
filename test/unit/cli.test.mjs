import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { cleanup, makeWorkspace, scrubbedEnv, writeScenario, ROOT } from '../support/harness.mjs';

const workspaces = [];
afterEach(() => workspaces.splice(0).forEach(cleanup));

function cli(args, scenario) {
  const dir = makeWorkspace('single');
  workspaces.push(dir);
  const env = scrubbedEnv(dir, { NPM_SHIM_SCENARIO: writeScenario(dir, scenario) });
  return spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'cli.mjs'), ...args], { env, cwd: dir, encoding: 'utf8' });
}

test('check-dist-tags passes when latest is unchanged and dev moved', () => {
  const result = cli(
    ['check-dist-tags', '--package', '@hagicode/example', '--latest', '1.4.1', '--dev', '1.4.2-dev.5.1.g1234567'],
    { distTags: { '@hagicode/example': { latest: '1.4.1', dev: '1.4.2-dev.5.1.g1234567' } } },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /latest 1\.4\.1, dev 1\.4\.2-dev\.5\.1\.g1234567/);
});

test('check-dist-tags exits non-zero and prints both values when latest moved', () => {
  const result = cli(
    ['check-dist-tags', '--package', '@hagicode/example', '--latest', '1.4.1'],
    { distTags: { '@hagicode/example': { latest: '1.4.9', dev: '1.4.10-dev.5.1.g1234567' } } },
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /latest is 1\.4\.9, expected 1\.4\.1/);
});

test('check-dist-tags fails when dev did not move to the expected version', () => {
  const result = cli(
    ['check-dist-tags', '--package', '@hagicode/example', '--latest', '1.4.1', '--dev', '1.4.2-dev.6.1.g1234567'],
    { distTags: { '@hagicode/example': { latest: '1.4.1', dev: '1.4.2-dev.5.1.g1234567' } } },
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /dev is 1\.4\.2-dev\.5\.1\.g1234567, expected 1\.4\.2-dev\.6\.1\.g1234567/);
});

test('resolve prints the resolved context as JSON without writing outputs', () => {
  const dir = makeWorkspace('single');
  workspaces.push(dir);
  const env = scrubbedEnv(dir, {
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_REF_NAME: 'main',
    GITHUB_REPOSITORY: 'HagiCode-org/example',
    GITHUB_WORKFLOW_REF: 'HagiCode-org/example/.github/workflows/npm-publish.yml@refs/heads/main',
    GITHUB_SHA: 'ab12cd9f00',
    GITHUB_RUN_NUMBER: '57',
    GITHUB_RUN_ATTEMPT: '2',
  });
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'cli.mjs'), 'resolve'], { env, cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const context = JSON.parse(result.stdout);
  assert.equal(context.version, '1.4.2-dev.57.2.ab12cd9');
  assert.equal(context.mode, 'dev');
});
