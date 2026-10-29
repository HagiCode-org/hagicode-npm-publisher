import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveContext, checkRepositoryAndWorkflow } from '../../scripts/lib/context.mjs';
import { makeWorkspace, cleanup, ciEnv, CI_REPOSITORY, CI_WORKFLOW_REF, patchManifest } from '../support/harness.mjs';

const workspaces = [];
afterEach(() => workspaces.splice(0).forEach(cleanup));
const ws = (fixture) => {
  const dir = makeWorkspace(fixture);
  workspaces.push(dir);
  return dir;
};

test('a draft release resolves to run=false with a reason, not an error', () => {
  const dir = ws('single');
  const env = ciEnv(dir, { event: 'release-draft', name: 'release', ref: 'refs/tags/v1.4.2', refName: 'v1.4.2' });
  const context = resolveContext({ env, root: dir });
  assert.equal(context.run, false);
  assert.match(context.skipReason, /is a draft/);
});

test('a prerelease resolves to run=false', () => {
  const dir = ws('single');
  const env = ciEnv(dir, { event: 'release-prerelease', name: 'release', ref: 'refs/tags/v1.4.2-rc.1', refName: 'v1.4.2-rc.1' });
  assert.match(resolveContext({ env, root: dir }).skipReason, /is a prerelease/);
});

test('a published stable release resolves to release mode with latest', () => {
  const dir = ws('single');
  const env = ciEnv(dir, { event: 'release-published', name: 'release', ref: 'refs/tags/v1.4.2', refName: 'v1.4.2' });
  const context = resolveContext({ env, root: dir });
  assert.equal(context.mode, 'release');
  assert.equal(context.version, '1.4.2');
  assert.equal(context.distTag, 'latest');
});

test('a stable tag that disagrees with package.json fails before install', () => {
  const dir = ws('single');
  patchManifest(dir, '.', { version: '1.4.1' });
  const env = ciEnv(dir, { event: 'release-published', name: 'release', ref: 'refs/tags/v1.4.2', refName: 'v1.4.2' });
  assert.throws(() => resolveContext({ env, root: dir }), /gives version 1\.4\.2 but \. declares 1\.4\.1/);
});

test('a dev run builds the version from base-version and the CI variables', () => {
  const dir = ws('single');
  const env = ciEnv(dir, { inputs: { 'base-version': '0.4.0' } });
  const context = resolveContext({ env, root: dir });
  assert.equal(context.mode, 'dev');
  assert.equal(context.version, '0.4.0-dev.57.2.ab12cd9');
  assert.equal(context.distTag, 'dev');
});

test('a run from another workflow file is refused and both paths are named', () => {
  const dir = ws('single');
  const env = ciEnv(dir, { extra: { GITHUB_WORKFLOW_REF: `${CI_REPOSITORY}/.github/workflows/other.yml@refs/heads/main` } });
  assert.throws(
    () => resolveContext({ env, root: dir }),
    (error) =>
      /"\.github\/workflows\/other\.yml"/.test(error.message) &&
      /expected-workflow is "\.github\/workflows\/npm-publish\.yml"/.test(error.message) &&
      /bound to the workflow filename/.test(error.message),
  );
});

test('expected-repository refuses a run from a fork or another repository', () => {
  const dir = ws('single');
  const env = ciEnv(dir, { inputs: { 'expected-repository': 'HagiCode-org/hagilight' } });
  assert.throws(() => resolveContext({ env, root: dir }), /expected-repository is "HagiCode-org\/hagilight"/);
});

test('an unsupported event fails before install and names the event', () => {
  const dir = ws('single');
  const env = ciEnv(dir, { event: 'pull-request', name: 'pull_request', ref: 'refs/pull/7/merge', refName: '7/merge' });
  assert.throws(() => resolveContext({ env, root: dir }), /Unsupported event "pull_request"/);
});

test('the package manager follows the pnpm lockfile when package-manager is auto', () => {
  const dir = ws('single');
  const npmContext = resolveContext({ env: ciEnv(dir), root: dir });
  assert.equal(npmContext.packageManager, 'npm');
  assert.equal(npmContext.installCommand, 'npm ci');
  require_pnpm_lock(dir);
  const pnpmContext = resolveContext({ env: ciEnv(dir), root: dir });
  assert.equal(pnpmContext.packageManager, 'pnpm');
  assert.equal(pnpmContext.installCommand, 'pnpm install --frozen-lockfile');
});

test('an empty install-command skips the install', () => {
  const dir = ws('single');
  const context = resolveContext({ env: ciEnv(dir, { inputs: { 'install-command': '' } }), root: dir });
  assert.equal(context.installCommand, '');
});

test('checkRepositoryAndWorkflow tolerates a missing ref only in dry-run', () => {
  assert.doesNotThrow(() =>
    checkRepositoryAndWorkflow({ repository: CI_REPOSITORY, workflowRef: '', expectedRepository: '', expectedWorkflow: '.github/workflows/npm-publish.yml', dryRun: true }),
  );
  assert.throws(() =>
    checkRepositoryAndWorkflow({ repository: CI_REPOSITORY, workflowRef: '', expectedRepository: '', expectedWorkflow: '.github/workflows/npm-publish.yml', dryRun: false }),
  );
  assert.doesNotThrow(() =>
    checkRepositoryAndWorkflow({ repository: CI_REPOSITORY, workflowRef: CI_WORKFLOW_REF, expectedRepository: '', expectedWorkflow: '.github/workflows/npm-publish.yml', dryRun: false }),
  );
});

// resolveContext only checks that the pnpm lockfile exists, so its content is not needed.
function require_pnpm_lock(dir) {
  fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
}

test('a tag push of a stable tag runs in release mode, read from GITHUB_REF_NAME', () => {
  const dir = ws('single');
  const env = ciEnv(dir, { event: 'push-tag', name: 'push', ref: 'refs/tags/v1.4.2', refName: 'v1.4.2' });
  const context = resolveContext({ env, root: dir });
  assert.equal(context.mode, 'release');
  assert.equal(context.version, '1.4.2');
  assert.equal(context.distTag, 'latest');
});

test('a tag push that is not vX.Y.Z is refused with the format named', () => {
  const dir = ws('single');
  const env = ciEnv(dir, { event: 'push-tag', name: 'push', ref: 'refs/tags/v1.4.2-beta.1', refName: 'v1.4.2-beta.1' });
  assert.throws(() => resolveContext({ env, root: dir }), /requires a tag of the form vX\.Y\.Z/);
});
