import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCRIPTS = path.join(ROOT, 'scripts');
export const FIXTURES = path.join(ROOT, 'test', 'fixtures');
export const SHIM_DIR = path.join(FIXTURES, 'shims', 'bin');

export const CI_REPOSITORY = 'HagiCode-org/example';
export const CI_WORKFLOW_REF = `${CI_REPOSITORY}/.github/workflows/npm-publish.yml@refs/heads/main`;

/** Copy a fixture package set into a fresh workspace. Returns the workspace path. */
export function makeWorkspace(fixture = 'single') {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-publisher-test-'));
  const source = path.join(FIXTURES, 'packages', fixture);
  copyTree(source, workspace);
  return workspace;
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

/** Merge fields into a workspace package.json (path is relative to the workspace root). */
export function patchManifest(workspace, relativePath, patch) {
  const file = path.join(workspace, relativePath, 'package.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, `${JSON.stringify({ ...json, ...patch }, null, 2)}\n`);
}

/** The environment a step sees. Only the shims, node and the system path are visible. */
export function scrubbedEnv(workspace, extra = {}) {
  const home = path.join(workspace, '.home');
  fs.mkdirSync(home, { recursive: true });
  return {
    PATH: [SHIM_DIR, path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter),
    HOME: home,
    LANG: 'C',
    GITHUB_WORKSPACE: workspace,
    PUBLISH_STATE_DIR: path.join(workspace, '.state'),
    GITHUB_OUTPUT: path.join(workspace, '.github-output'),
    GITHUB_STEP_SUMMARY: path.join(workspace, '.step-summary'),
    NPM_SHIM_LOG: path.join(workspace, '.npm-shim.log'),
    ...extra,
  };
}

/** GitHub-like CI variables for an event. Put INPUT_* values in `inputs`, kebab-case keys. */
export function ciEnv(workspace, { event = 'push-main', name = 'push', ref = 'refs/heads/main', refName = 'main', inputs = {}, extra = {} } = {}) {
  const eventPath = path.join(workspace, '.event.json');
  fs.copyFileSync(path.join(FIXTURES, 'events', `${event}.json`), eventPath);
  const env = scrubbedEnv(workspace, {
    GITHUB_EVENT_NAME: name,
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_REF: ref,
    GITHUB_REF_NAME: refName,
    GITHUB_REPOSITORY: CI_REPOSITORY,
    GITHUB_WORKFLOW_REF: CI_WORKFLOW_REF,
    GITHUB_SHA: 'AB12cd9f00',
    GITHUB_RUN_NUMBER: '57',
    GITHUB_RUN_ATTEMPT: '2',
    ...extra,
  });
  for (const [key, value] of Object.entries(inputs)) {
    env[`INPUT_${key.toUpperCase()}`] = value;
  }
  return env;
}

/** Run one step script with the given environment. */
export function runScript(script, env, cwd = env.GITHUB_WORKSPACE) {
  const result = spawnSync(process.execPath, [path.join(SCRIPTS, script)], { env, cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

export function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

export function readState(env) {
  return JSON.parse(fs.readFileSync(path.join(env.PUBLISH_STATE_DIR, 'state.json'), 'utf8'));
}

export function readOutputs(env) {
  if (!fs.existsSync(env.GITHUB_OUTPUT)) return {};
  const out = {};
  for (const line of fs.readFileSync(env.GITHUB_OUTPUT, 'utf8').split('\n')) {
    const match = /^([a-z-]+)=(.*)$/.exec(line);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

export function cleanup(workspace) {
  fs.rmSync(workspace, { recursive: true, force: true });
}

/** Write a scenario file for the npm shim and return its path. */
export function writeScenario(workspace, scenario) {
  const file = path.join(workspace, '.npm-scenario.json');
  fs.writeFileSync(file, JSON.stringify(scenario));
  return file;
}
