#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ActionError, runMain, isEntry } from './lib/errors.mjs';
import { run as runCommand } from './lib/exec.mjs';
import { readState, stateDir, writeState } from './lib/state.mjs';

/**
 * Gate: the install must not have changed the lockfile. Checked with git diff against the index, so
 * it only runs inside a git work tree; outside one it is reported as skipped.
 */
export async function run(env = process.env) {
  const dir = stateDir(env);
  const { context } = readState(dir);
  if (!context?.run) {
    writeState(dir, { lockfile: { checked: false, reason: 'publish skipped' } });
    return 0;
  }
  if (!context.verifyLockfileStable) {
    writeState(dir, { lockfile: { checked: false, reason: 'verify-lockfile-stable is false' } });
    return 0;
  }
  const root = env.GITHUB_WORKSPACE || process.cwd();
  const cwd = path.join(root, context.workingDirectory);
  const lockfile = context.packageManager === 'pnpm' ? 'pnpm-lock.yaml' : 'package-lock.json';
  if (!fs.existsSync(path.join(cwd, lockfile))) {
    writeState(dir, { lockfile: { checked: false, reason: `no ${lockfile}` } });
    return 0;
  }
  const inside = await runCommand('git', ['rev-parse', '--is-inside-work-tree'], { cwd, tee: false, env });
  if (inside.code !== 0) {
    writeState(dir, { lockfile: { checked: false, reason: 'not a git work tree' } });
    return 0;
  }
  const diff = await runCommand('git', ['diff', '--exit-code', '--', lockfile], { cwd, env });
  if (diff.code !== 0) {
    throw new ActionError(
      `${lockfile} changed during install. Commit the lockfile that matches package.json, or fix the install so it does not rewrite it.`,
    );
  }
  writeState(dir, { lockfile: { checked: true, file: lockfile } });
  return 0;
}

if (isEntry(import.meta.url)) {
  await runMain(() => run());
}
