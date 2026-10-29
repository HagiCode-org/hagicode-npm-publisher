import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadPackages, stampPackages, writeManifests } from '../../scripts/lib/packages.mjs';
import { makeWorkspace, cleanup, FIXTURES } from '../support/harness.mjs';

const workspaces = [];
afterEach(() => workspaces.splice(0).forEach(cleanup));
const linked = () => {
  const ws = makeWorkspace('linked');
  workspaces.push(ws);
  return ws;
};
const write = (ws, dir, json) => {
  fs.mkdirSync(path.join(ws, dir), { recursive: true });
  fs.writeFileSync(path.join(ws, dir, 'package.json'), `${JSON.stringify(json, null, 2)}\n`);
};

test('packages load in the caller order and are not re-sorted', () => {
  const ws = linked();
  const pkgs = loadPackages({ root: ws, workingDirectory: '.', dirs: ['feature-a', 'core', 'standalone'] });
  assert.deepEqual(pkgs.map((p) => p.name), ['@hagicode/fixture-feature-a', '@hagicode/fixture-core', '@hagicode/fixture-standalone']);
});

test('a private package is rejected by name', () => {
  const ws = linked();
  write(ws, 'secret', { name: '@hagicode/secret', version: '1.0.0', private: true });
  assert.throws(
    () => loadPackages({ root: ws, workingDirectory: '.', dirs: ['secret'] }),
    /"@hagicode\/secret" \(secret\) is private/,
  );
});

test('duplicate names and missing manifests are rejected', () => {
  const ws = linked();
  assert.throws(
    () => loadPackages({ root: ws, workingDirectory: '.', dirs: ['core', 'core'] }),
    /listed twice/,
  );
  assert.throws(
    () => loadPackages({ root: ws, workingDirectory: '.', dirs: ['nothing-here'] }),
    /package manifest not found: nothing-here\/package.json/,
  );
});

test('linked stamping rewrites exact pins and warns on ranges', () => {
  const ws = linked();
  const pkgs = loadPackages({
    root: ws,
    workingDirectory: '.',
    dirs: ['core', 'standalone', 'feature-a', 'feature-b', 'feature-c'],
  });
  const { warnings, rewrites } = stampPackages({ packages: pkgs, version: '0.6.1-dev.12.1.abc1234' });
  writeManifests(pkgs);
  const featureA = JSON.parse(fs.readFileSync(path.join(ws, 'feature-a', 'package.json'), 'utf8'));
  const featureC = JSON.parse(fs.readFileSync(path.join(ws, 'feature-c', 'package.json'), 'utf8'));
  assert.equal(featureA.version, '0.6.1-dev.12.1.abc1234');
  assert.equal(featureA.dependencies['@hagicode/fixture-core'], '0.6.1-dev.12.1.abc1234');
  assert.equal(featureC.dependencies['@hagicode/fixture-core'], '^0.6.0', 'range specifier is preserved');
  assert.ok(warnings.some((w) => w.includes('@hagicode/fixture-feature-c') && w.includes('"^0.6.0"')));
  assert.equal(rewrites.length, 2);
});

test('manifest indentation is preserved when writing', () => {
  const ws = linked();
  const file = path.join(ws, 'core', 'package.json');
  fs.writeFileSync(file, `{\n    "name": "@hagicode/fixture-core",\n    "version": "0.6.1"\n}\n`);
  const pkgs = loadPackages({ root: ws, workingDirectory: '.', dirs: ['core'] });
  stampPackages({ packages: pkgs, version: '0.6.2' });
  writeManifests(pkgs);
  assert.match(fs.readFileSync(file, 'utf8'), /\n {4}"name"/);
});

test('fixtures directory holds the five linked packages', () => {
  assert.equal(fs.readdirSync(path.join(FIXTURES, 'packages', 'linked')).length, 5);
});
