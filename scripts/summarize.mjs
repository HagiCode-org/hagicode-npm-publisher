#!/usr/bin/env node
import { runMain, isEntry } from './lib/errors.mjs';
import { readState, stateDir } from './lib/state.mjs';
import { appendStepSummary, renderSummary, writeOutputs } from './lib/summary.mjs';

/**
 * Step 4 (always runs): expose the outputs and write the job summary. Tolerates any missing earlier
 * state, so a run that failed at resolve-context still produces outputs.
 */
export function run(env = process.env) {
  const state = readState(stateDir(env));
  const context = state.context || {};
  const publish = state.publish || {};
  const published = publish.published || [];
  const skipped = publish.skipped || [];
  let steps = {};
  try {
    steps = env.STEPS_JSON ? JSON.parse(env.STEPS_JSON) : {};
  } catch {
    steps = {};
  }

  if (env.GITHUB_OUTPUT) {
    writeOutputs(env.GITHUB_OUTPUT, {
      version: context.version || '',
      'dist-tag': context.distTag || '',
      mode: context.mode || '',
      published: published.length > 0 ? 'true' : 'false',
      'published-packages': JSON.stringify(published),
      'skipped-packages': JSON.stringify(skipped),
      'package-manager': context.packageManager || '',
    });
  }

  if (env.INPUT_SUMMARY !== 'false' && env.GITHUB_STEP_SUMMARY) {
    appendStepSummary(
      env.GITHUB_STEP_SUMMARY,
      renderSummary({ context, publish, stamp: state.stamp || {}, steps }),
    );
  }
  return 0;
}

if (isEntry(import.meta.url)) {
  await runMain(() => run());
}
