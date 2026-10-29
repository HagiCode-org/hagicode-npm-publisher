import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyFailure, redact, renderDiagnostics, workflowFileOf } from '../../scripts/lib/diagnostics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(here, '..', 'fixtures', 'npm-output', `${name}.txt`), 'utf8');
const golden = (name) => fs.readFileSync(path.join(here, '..', 'golden', 'diagnostics', `${name}.txt`), 'utf8');

const cases = {
  e404: { cls: 'E404', oidcPresent: true },
  e403: { cls: 'E403', oidcPresent: true },
  e401: { cls: 'E401', oidcPresent: false },
  provenance: { cls: 'provenance', oidcPresent: true },
  unknown: { cls: 'unknown', oidcPresent: true },
};

for (const [name, { cls: expectedClass, oidcPresent }] of Object.entries(cases)) {
  test(`classifies and renders the ${name} fixture against its golden file`, () => {
    const cls = classifyFailure(fixture(name));
    assert.equal(cls, expectedClass);
    const text = renderDiagnostics({
      cls,
      packageName: '@hagicode/example',
      repository: 'HagiCode-org/example',
      workflowFile: '.github/workflows/npm-publish.yml',
      oidcPresent,
    });
    assert.equal(text, golden(name));
  });
}

test('E401 without OIDC points at id-token: write; with OIDC it does not', () => {
  assert.match(renderDiagnostics({ cls: 'E401', packageName: 'x', repository: 'o/r', workflowFile: 'w.yml', oidcPresent: false }), /id-token: write/);
  assert.doesNotMatch(renderDiagnostics({ cls: 'E401', packageName: 'x', repository: 'o/r', workflowFile: 'w.yml', oidcPresent: true }), /id-token: write/);
});

test('diagnostics name the runtime package, repository and workflow, never a fixed one', () => {
  const text = renderDiagnostics({ cls: 'E404', packageName: '@acme/widget', repository: 'Acme/widgets', workflowFile: 'release.yml', oidcPresent: true });
  assert.match(text, /@acme\/widget/);
  assert.match(text, /scope "@acme"/);
  assert.match(text, /Acme\/widgets/);
  assert.match(text, /release\.yml/);
  assert.doesNotMatch(text, /hagicode|imgbin|HagiCode-org/);
});

test('credential values are redacted from printed text', () => {
  assert.equal(redact('//registry.npmjs.org/:_authToken=npm_abcdef123'), '//registry.npmjs.org/:_authToken=[REDACTED]');
  assert.equal(redact('token npm_abcdefghijklmnopqrstu1234 leaked'), 'token [REDACTED] leaked');
  assert.equal(redact('npm_config_cache is fine'), 'npm_config_cache is fine');
});

test('workflow filename is taken from GITHUB_WORKFLOW_REF', () => {
  assert.equal(workflowFileOf('HagiCode-org/example/.github/workflows/npm-publish.yml@refs/heads/main', 'HagiCode-org/example'), '.github/workflows/npm-publish.yml');
});
