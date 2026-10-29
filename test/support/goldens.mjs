import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDiagnostics, classifyFailure } from '../../scripts/lib/diagnostics.mjs';
import { renderSummary } from '../../scripts/lib/summary.mjs';
import { listProfiles, profileGolden } from './profiles.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const GOLDEN = path.join(here, '..', 'golden');
export const FIXTURES = path.join(here, '..', 'fixtures');

export const DIAGNOSTIC_CASES = {
  e404: { oidcPresent: true },
  e403: { oidcPresent: true },
  e401: { oidcPresent: false },
  provenance: { oidcPresent: true },
  unknown: { oidcPresent: true },
};

export const SUMMARY_STATES = ['dev-success', 'release-success', 'skipped', 'failed'];

/** Every golden document as { relativePath: content }. Used by the regeneration script and the tests. */
export function expectedGoldens() {
  const out = {};
  for (const [name, options] of Object.entries(DIAGNOSTIC_CASES)) {
    const text = fs.readFileSync(path.join(FIXTURES, 'npm-output', `${name}.txt`), 'utf8');
    const cls = classifyFailure(text);
    out[`diagnostics/${name}.txt`] = renderDiagnostics({
      cls,
      packageName: '@hagicode/example',
      repository: 'HagiCode-org/example',
      workflowFile: '.github/workflows/npm-publish.yml',
      ...options,
    });
  }
  for (const name of SUMMARY_STATES) {
    const state = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'state', `${name}.json`), 'utf8'));
    out[`summaries/${name}.md`] = renderSummary(state);
  }
  for (const name of listProfiles()) {
    out[`resolved/${name}.json`] = `${JSON.stringify(profileGolden(name), null, 2)}\n`;
  }
  return out;
}
