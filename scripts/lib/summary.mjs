import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { redact } from './redact.mjs';

/** Append key=value lines to $GITHUB_OUTPUT, using a heredoc for multi-line values. */
export function writeOutputs(file, pairs) {
  const chunks = [];
  for (const [key, rawValue] of Object.entries(pairs)) {
    const value = String(rawValue ?? '');
    if (value.includes('\n')) {
      const delimiter = `EOF_${randomUUID()}`;
      chunks.push(`${key}<<${delimiter}\n${value}\n${delimiter}\n`);
    } else {
      chunks.push(`${key}=${value}\n`);
    }
  }
  fs.appendFileSync(file, chunks.join(''));
}

export function appendStepSummary(file, markdown) {
  fs.appendFileSync(file, redact(markdown));
}

/** Gate rows in the order of the spec. Ids match the step ids in action.yml. */
export const GATES = Object.freeze([
  ['context', 'Context and validation'],
  ['pnpm', 'pnpm setup'],
  ['node', 'Node setup'],
  ['install', 'Install dependencies'],
  ['lockfile', 'Lockfile stability'],
  ['stamp', 'Version stamping'],
  ['hook', 'after-version-command'],
  ['typecheck', 'Typecheck'],
  ['build', 'Build'],
  ['test', 'Test'],
  ['neutrality', 'Registry-neutrality command'],
  ['verify-packages', 'Pack check and package verification'],
  ['verify-command', 'verify-command'],
  ['publish', 'Publish'],
]);

const OUTCOME_LABEL = { success: 'passed', failure: 'failed', skipped: 'skipped', cancelled: 'cancelled' };

function listOrNone(items) {
  return items.length === 0 ? '_none_' : items.map((item) => `\`${item}\``).join(', ');
}

/** Deterministic Markdown for the job summary; no timestamps, so goldens stay stable. */
export function renderSummary({ context = {}, publish = {}, stamp = {}, steps = {} }) {
  const lines = [];
  const title = context.run === false ? 'npm publish skipped' : 'npm publish';
  lines.push(`## ${title}`, '');

  if (context.run === false) {
    lines.push(`**Published: false.** ${context.skipReason || 'The run did not publish.'}`, '');
    return `${lines.join('\n')}\n`;
  }

  lines.push('| Field | Value |', '| --- | --- |');
  lines.push(`| Mode | ${context.mode ?? '—'} |`);
  lines.push(`| Version | ${context.version ? `\`${context.version}\`` : '—'} |`);
  lines.push(`| Dist-tag | ${context.distTag ?? '—'} |`);
  lines.push(`| Package manager | ${context.packageManager ?? '—'} |`);
  lines.push(`| Dry run | ${context.dryRun ? 'yes' : 'no'} |`, '');

  if (context.dryRun) {
    lines.push(`**Dry run: nothing was published.** Would publish: ${listOrNone(publish.planned ?? [])}`, '');
  } else {
    lines.push(`**Published:** ${listOrNone(publish.published ?? [])}`, '');
    lines.push(`**Skipped (already in registry):** ${listOrNone(publish.skipped ?? [])}`, '');
    if ((publish.notAttempted ?? []).length > 0) {
      lines.push(`**Not attempted:** ${listOrNone(publish.notAttempted)}`, '');
    }
  }

  lines.push('### Gates', '', '| Gate | Result |', '| --- | --- |');
  for (const [id, label] of GATES) {
    const outcome = steps[id]?.outcome;
    const result = outcome ? OUTCOME_LABEL[outcome] ?? outcome : 'not reached';
    lines.push(`| ${label} | ${result} |`);
  }
  lines.push('');

  const warnings = [...(context.warnings ?? []), ...(stamp.warnings ?? [])];
  if (warnings.length > 0) {
    lines.push('### Warnings', '', ...warnings.map((warning) => `- ${warning}`), '');
  }

  if (publish.failure) {
    const failure = publish.failure;
    lines.push(
      '### Failure',
      '',
      `**${failure.name}@${failure.version}** (dist-tag \`${failure.distTag}\`) failed with class \`${failure.class}\`.`,
      '',
      ...failure.guidance.map((line) => `- ${line}`),
      '',
    );
  }
  return `${lines.join('\n')}\n`;
}
