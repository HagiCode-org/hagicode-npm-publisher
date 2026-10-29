import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  makeWorkspace,
  cleanup,
  ciEnv,
  runScript,
  readState,
  readOutputs,
  readJsonLines,
  writeScenario,
} from '../support/harness.mjs';

const workspaces = [];
afterEach(() => workspaces.splice(0).forEach(cleanup));

const LINKED = ['core', 'standalone', 'feature-a', 'feature-b', 'feature-c'];
const OIDC = { ACTIONS_ID_TOKEN_REQUEST_URL: 'https://oidc.example', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'token' };

function setup({ scenario = {}, inputs = {}, oidc = true, dryRun = false } = {}) {
  const dir = makeWorkspace('linked');
  workspaces.push(dir);
  const env = ciEnv(dir, {
    inputs: { packages: LINKED.join('\n'), 'dry-run': String(dryRun), ...inputs },
    extra: { NPM_SHIM_SCENARIO: writeScenario(dir, scenario), ...(oidc ? OIDC : {}) },
  });
  return { dir, env };
}

/**
 * Run the step scripts in order, stopping at the first failure like composite steps do. The summary
 * always runs (if: always() in action.yml), so outputs exist even after a failure.
 */
function chain(env, scripts = ['resolve-context.mjs', 'stamp-versions.mjs', 'verify-lockfile.mjs', 'verify-packages.mjs', 'publish.mjs']) {
  let failure = null;
  for (const script of scripts) {
    const result = runScript(script, env);
    if (result.status !== 0) {
      failure = { ...result, script };
      break;
    }
  }
  const summary = runScript('summarize.mjs', env);
  return failure ?? { ...summary, script: 'done' };
}

const publishCalls = (env) => readJsonLines(env.NPM_SHIM_LOG).filter((entry) => entry.args?.[0] === 'publish');

test('publishes all five linked packages in order with dev tag, access, provenance and registry', () => {
  const { env } = setup();
  const result = chain(env);
  assert.equal(result.status, 0, result.stderr);
  const calls = publishCalls(env);
  assert.deepEqual(calls.map((call) => path.basename(call.cwd)), LINKED);
  assert.deepEqual(calls[0].args, ['publish', '--tag', 'dev', '--access', 'public', '--registry', 'https://registry.npmjs.org', '--provenance']);
  const outputs = readOutputs(env);
  assert.equal(outputs.published, 'true');
  assert.equal(outputs.version, '0.6.1-dev.57.2.ab12cd9');
  assert.equal(outputs['dist-tag'], 'dev');
  assert.equal(JSON.parse(outputs['published-packages']).length, 5);
});

test('resume: versions already in the registry are skipped and the rest publish', () => {
  const version = '0.6.1-dev.57.2.ab12cd9';
  const { env } = setup({
    scenario: { view: { '@hagicode/fixture-core': { versions: [version] }, '@hagicode/fixture-standalone': { versions: [version] } } },
  });
  assert.equal(chain(env).status, 0);
  assert.deepEqual(publishCalls(env).map((call) => path.basename(call.cwd)), ['feature-a', 'feature-b', 'feature-c']);
  assert.deepEqual(JSON.parse(readOutputs(env)['skipped-packages']), [`@hagicode/fixture-core@${version}`, `@hagicode/fixture-standalone@${version}`]);
});

test('an unknown package (E404 on the registry query) is published normally', () => {
  const { env } = setup({ scenario: { view: { '@hagicode/fixture-core': { status: 'E404' } } } });
  assert.equal(chain(env).status, 0);
  assert.equal(publishCalls(env).length, 5);
});

test('a registry error other than 404 stops the run before any publish', () => {
  const { env } = setup({ scenario: { view: { '@hagicode/fixture-core': { status: 'E503' } } } });
  const result = chain(env);
  assert.notEqual(result.status, 0);
  assert.equal(publishCalls(env).length, 0);
  const state = readState(env);
  assert.equal(state.publish.failure.name, '@hagicode/fixture-core');
  assert.match(result.stderr, /registry query for @hagicode\/fixture-core failed/);
});

test('the first publish failure stops the loop: later packages are not attempted', () => {
  const { env } = setup({
    scenario: {
      publish: {
        '@hagicode/fixture-feature-a': {
          exit: 1,
          stderr: 'npm error code E403\nnpm error 403 You cannot publish over the previously published versions\n',
        },
      },
    },
  });
  const result = chain(env);
  assert.notEqual(result.status, 0);
  assert.deepEqual(publishCalls(env).map((call) => path.basename(call.cwd)), ['core', 'standalone', 'feature-a']);
  const state = readState(env);
  assert.deepEqual(state.publish.published, ['@hagicode/fixture-core@0.6.1-dev.57.2.ab12cd9', '@hagicode/fixture-standalone@0.6.1-dev.57.2.ab12cd9']);
  assert.equal(state.publish.failure.name, '@hagicode/fixture-feature-a');
  assert.equal(state.publish.failure.class, 'E403');
  assert.deepEqual(state.publish.notAttempted, ['@hagicode/fixture-feature-b@0.6.1-dev.57.2.ab12cd9', '@hagicode/fixture-feature-c@0.6.1-dev.57.2.ab12cd9']);
  assert.equal(readOutputs(env).published, 'true');
});

test('dry run performs every gate but never calls npm publish or the registry', () => {
  const { env } = setup({ dryRun: true });
  const result = chain(env);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(publishCalls(env).length, 0);
  assert.equal(readJsonLines(env.NPM_SHIM_LOG).filter((entry) => entry.args?.[0] === 'view').length, 0);
  assert.equal(readState(env).publish.planned.length, 5);
  assert.equal(readOutputs(env).published, 'false');
});

test('a missing OIDC identity fails before npm publish with the id-token guidance', () => {
  const { env } = setup({ oidc: false });
  const result = chain(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Grant "id-token: write"/);
  assert.equal(publishCalls(env).length, 0);
});

test('an npm CLI older than the trusted-publishing minimum is refused before publish', () => {
  const { env } = setup({ scenario: { version: '11.4.0' } });
  const result = chain(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /npm 11\.4\.0 is older than 11\.5\.1/);
  assert.equal(publishCalls(env).length, 0);
});

test('credentials printed by npm are redacted in the publish output', () => {
  const secret = 'npm_abcdefghijklmnopqrstu1234';
  const { env } = setup({
    scenario: {
      publish: {
        '@hagicode/fixture-core': { exit: 1, stderr: `npm error //registry.npmjs.org/:_authToken=${secret}\nnpm error code E401\n` },
      },
    },
  });
  const result = chain(env);
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(secret));
  assert.match(result.stderr, /\[REDACTED\]/);
});
