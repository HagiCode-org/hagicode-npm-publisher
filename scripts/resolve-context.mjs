#!/usr/bin/env node
import { resolveContext } from './lib/context.mjs';
import { runMain, isEntry } from './lib/errors.mjs';
import { stateDir, writeState } from './lib/state.mjs';
import { writeOutputs } from './lib/summary.mjs';

/** Step 1: validate and resolve the publish context, persist it, and expose the outputs. */
export function run(env = process.env) {
  const context = resolveContext({ env, root: env.GITHUB_WORKSPACE || process.cwd() });
  writeState(stateDir(env), { context, stamp: null, publish: null });
  if (env.GITHUB_OUTPUT) {
    writeOutputs(env.GITHUB_OUTPUT, {
      run: context.run ? 'true' : 'false',
      'skip-reason': context.skipReason,
      mode: context.mode,
      version: context.version,
      'dist-tag': context.distTag,
      'package-manager': context.packageManager,
      'default-install-command': context.defaultInstallCommand,
    });
  }
  if (!context.run) {
    console.log(`::notice::${context.skipReason}`);
  }
  return 0;
}

if (isEntry(import.meta.url)) {
  await runMain(() => run());
}
