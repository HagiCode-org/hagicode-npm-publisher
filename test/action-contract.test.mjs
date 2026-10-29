import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { DEFAULTS } from '../scripts/lib/inputs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const action = YAML.parse(fs.readFileSync(path.join(root, 'action.yml'), 'utf8'));
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

/** First-column names of the table rows under "## <heading>" in the English README. */
function tableNames(markdown, heading) {
  const start = markdown.indexOf(`\n## ${heading}\n`);
  assert.ok(start >= 0, `README has no "## ${heading}" section`);
  const rest = markdown.slice(start + 1);
  const end = rest.indexOf('\n## ', 1);
  const body = end === -1 ? rest : rest.slice(0, end);
  return body
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .map((line) => /^\| `([^`]+)`/.exec(line)[1]);
}

function scriptFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return scriptFiles(full);
    return entry.name.endsWith('.mjs') ? [full] : [];
  });
}

test('the action is a composite that runs its scripts through github.action_path', () => {
  assert.equal(action.runs.using, 'composite');
  for (const step of action.runs.steps) {
    if (typeof step.run === 'string' && step.run.includes('scripts/')) {
      assert.match(step.run, /\$\{\{ github\.action_path \}\}\/scripts\//, `step ${step.id} must use github.action_path`);
    }
  }
});

test('node-version defaults to 24 and provenance defaults to true', () => {
  assert.equal(action.inputs['node-version'].default, '24');
  assert.equal(action.inputs.provenance.default, 'true');
});

test('every input default equals the default the scripts use', () => {
  assert.deepEqual(Object.keys(action.inputs).sort(), Object.keys(DEFAULTS).sort());
  for (const [name, value] of Object.entries(DEFAULTS)) {
    assert.equal(String(action.inputs[name].default ?? ''), value, `default of ${name}`);
  }
});

test('inputs match the README input table exactly', () => {
  assert.deepEqual(tableNames(readme, 'Inputs'), Object.keys(action.inputs));
});

test('outputs match the README output table exactly', () => {
  assert.deepEqual(tableNames(readme, 'Outputs'), Object.keys(action.outputs));
});

test('the gate order is the fixed order from the spec', () => {
  assert.deepEqual(
    action.runs.steps.map((step) => step.id),
    ['context', 'pnpm', 'node', 'install', 'lockfile', 'stamp', 'hook', 'typecheck', 'build', 'test', 'neutrality', 'verify-packages', 'verify-command', 'publish', 'summarize'],
  );
});

test('the summary runs under always() and every gate requires earlier steps to succeed', () => {
  const byId = Object.fromEntries(action.runs.steps.map((step) => [step.id, step]));
  assert.equal(byId.summarize.if, '${{ always() }}');
  for (const id of ['install', 'stamp', 'publish', 'test', 'verify-packages']) {
    assert.match(byId[id].if, /success\(\)/, `${id} must not run after an earlier failure`);
  }
});

test('every outputs entry is read from the summarize step', () => {
  for (const output of Object.values(action.outputs)) {
    assert.match(output.value, /^\$\{\{ steps\.summarize\.outputs\.[a-z-]+ \}\}$/);
  }
});

test('every uses: reference is pinned to a single major', () => {
  for (const step of action.runs.steps) {
    if (step.uses) assert.match(step.uses, /@v\d+$/, `${step.uses} must pin a major`);
  }
});

test('scripts contain no hard-coded caller repository or package names', () => {
  const forbidden = [/HagiCode-org\//, /@hagicode\//, /\b(imgbin|hagilight|hagiscript|hagi18n|hagitask|hagi-release-drafter)\b/i];
  for (const file of scriptFiles(path.join(root, 'scripts'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of forbidden) {
      assert.doesNotMatch(text, pattern, `${path.relative(root, file)} contains ${pattern}`);
    }
  }
});
