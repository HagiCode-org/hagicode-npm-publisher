import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Directory shared by the step scripts of one job. */
export function stateDir(env = process.env) {
  return env.PUBLISH_STATE_DIR || path.join(env.RUNNER_TEMP || os.tmpdir(), 'hagicode-npm-publisher');
}

export function readState(dir) {
  const file = path.join(dir, 'state.json');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Shallow-merge a patch into the state file and return the merged state. */
export function writeState(dir, patch) {
  fs.mkdirSync(dir, { recursive: true });
  const next = { ...readState(dir), ...patch };
  fs.writeFileSync(path.join(dir, 'state.json'), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
