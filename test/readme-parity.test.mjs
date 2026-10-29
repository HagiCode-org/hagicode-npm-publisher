import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'README.md',
  'README.zh-CN.md',
  'README.zh-Hant.md',
  'README.ja-JP.md',
  'README.ko-KR.md',
  'README.de-DE.md',
  'README.fr-FR.md',
  'README.es-ES.md',
  'README.pt-BR.md',
  'README.ru-RU.md',
];

const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const headingCount = (text) => text.split('\n').filter((line) => line.startsWith('## ')).length;
const fenceCount = (text) => text.split('\n').filter((line) => line.startsWith('```')).length;
const tableNames = (text) => text.split('\n').filter((line) => line.startsWith('| `')).map((line) => /^\| `([^`]+)`/.exec(line)[1]);

test('all ten README files exist', () => {
  for (const name of FILES) assert.ok(fs.existsSync(path.join(root, name)), `${name} is missing`);
});

const english = read('README.md');

for (const name of FILES.slice(1)) {
  test(`${name} has the same sections, code blocks and table rows as the English README`, () => {
    const text = read(name);
    assert.equal(headingCount(text), headingCount(english), 'level-2 heading count');
    assert.equal(fenceCount(text), fenceCount(english), 'code fence count');
    assert.deepEqual(tableNames(text), tableNames(english), 'input and output names in order');
  });

  test(`${name} contains the caller example with id-token permission`, () => {
    const text = read(name);
    assert.match(text, /```yaml[\s\S]*?uses: HagiCode-org\/hagicode-npm-publisher@v1[\s\S]*?```/);
    assert.match(text, /id-token: write/);
  });
}

test('the English caller example grants id-token and contents permissions', () => {
  assert.match(english, /permissions:\n {2}contents: read\n {2}id-token: write/);
});
