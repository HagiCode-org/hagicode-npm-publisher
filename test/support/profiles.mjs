import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  makeWorkspace,
  patchManifest,
  ciEnv,
  runScript,
  readState,
  readOutputs,
  readJsonLines,
  writeScenario,
  cleanup,
} from './harness.mjs';

export const PROFILE_DIR = path.join(ROOT, 'test', 'profiles');
export const SCRIPT_CHAIN = [
  'resolve-context.mjs',
  'stamp-versions.mjs',
  'verify-lockfile.mjs',
  'verify-packages.mjs',
  'publish.mjs',
  'summarize.mjs',
];

export function listProfiles() {
  return fs
    .readdirSync(PROFILE_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/, ''))
    .sort();
}

export function loadProfile(name) {
  return JSON.parse(fs.readFileSync(path.join(PROFILE_DIR, `${name}.json`), 'utf8'));
}

/**
 * Replay one caller profile through the step scripts in dry-run. The profile carries only the
 * inputs and event the caller would pass; commands (build, test, ...) belong to composite steps and
 * are not executed here. Returns the resolved context, outputs and the publish plan.
 */
export function replayProfile(name) {
  const profile = loadProfile(name);
  const workspace = makeWorkspace(profile.fixture);
  try {
    for (const [dir, patch] of Object.entries(profile.manifestPatches ?? {})) {
      patchManifest(workspace, dir, patch);
    }
    const env = ciEnv(workspace, {
      event: profile.event,
      name: profile.eventName,
      ref: profile.ref,
      refName: profile.refName,
      inputs: { 'dry-run': 'true', ...profile.inputs },
      extra: { NPM_SHIM_SCENARIO: writeScenario(workspace, profile.scenario ?? {}) },
    });
    const failures = [];
    for (const script of SCRIPT_CHAIN) {
      const result = runScript(script, env);
      if (result.status !== 0) {
        failures.push({ script, stderr: result.stderr });
        break;
      }
    }
    const state = readState(env);
    const publishCalls = readJsonLines(env.NPM_SHIM_LOG).filter((entry) => entry.args?.[0] === 'publish');
    return {
      profile,
      failures,
      context: state.context,
      planned: state.publish?.planned ?? [],
      outputs: readOutputs(env),
      publishCalls: publishCalls.length,
    };
  } finally {
    cleanup(workspace);
  }
}

/** The golden document for a profile: the resolved context, the outputs and the dry-run plan. */
export function profileGolden(name) {
  const replay = replayProfile(name);
  return {
    context: replay.context,
    outputs: replay.outputs,
    planned: replay.planned,
  };
}
