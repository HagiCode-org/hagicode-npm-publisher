import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertStableAgreement,
  resolveDistTag,
  resolveMode,
  versionFromStableTag,
} from '../../scripts/lib/version.mjs';

const push = (ref) => ({ eventName: 'push', eventAction: '', ref });

test('auto selects dev for a branch push and release for a tag push', () => {
  assert.equal(resolveMode({ requested: 'auto', ...push('refs/heads/main') }), 'dev');
  assert.equal(resolveMode({ requested: 'auto', ...push('refs/tags/v1.4.2') }), 'release');
});

test('auto selects release for a published release', () => {
  assert.equal(
    resolveMode({ requested: 'auto', eventName: 'release', eventAction: 'published', ref: 'refs/tags/v1.4.2' }),
    'release',
  );
});

test('an unsupported event fails and names the event', () => {
  assert.throws(
    () => resolveMode({ requested: 'auto', eventName: 'pull_request', eventAction: 'opened', ref: 'refs/pull/7/merge' }),
    /Unsupported event "pull_request"/,
  );
});

test('a non-published release action is refused in auto mode', () => {
  assert.throws(
    () => resolveMode({ requested: 'auto', eventName: 'release', eventAction: 'created', ref: 'refs/tags/v1.4.2' }),
    /Release action "created" is not supported/,
  );
});

test('an explicit mode is validated against the event', () => {
  assert.throws(() => resolveMode({ requested: 'dev', ...push('refs/tags/v1.4.2') }), /needs a push to a branch/);
  assert.throws(() => resolveMode({ requested: 'release', ...push('refs/heads/main') }), /needs a published release/);
  assert.equal(resolveMode({ requested: 'dev', ...push('refs/heads/main') }), 'dev');
});

test('stable tags must be vX.Y.Z and yield the bare version', () => {
  assert.equal(versionFromStableTag('v1.4.2'), '1.4.2');
  assert.throws(() => versionFromStableTag('v1.4.2-beta.1'), /requires a tag of the form vX.Y.Z/);
  assert.throws(() => versionFromStableTag('1.4.2'), /requires a tag of the form vX.Y.Z/);
  assert.throws(() => versionFromStableTag(undefined), /requires a tag of the form vX.Y.Z/);
});

test('stable tag and package.json must agree, and the message shows both', () => {
  assert.doesNotThrow(() => assertStableAgreement([{ dir: '.', version: '1.4.2' }], '1.4.2'));
  assert.throws(
    () => assertStableAgreement([{ dir: '.', version: '1.4.1' }], '1.4.2'),
    /gives version 1\.4\.2 but \. declares 1\.4\.1/,
  );
});

test('dist-tag rules: dev never claims latest, release only latest', () => {
  assert.equal(resolveDistTag({ mode: 'dev', input: '' }), 'dev');
  assert.equal(resolveDistTag({ mode: 'dev', input: 'next' }), 'next');
  assert.equal(resolveDistTag({ mode: 'release', input: '' }), 'latest');
  assert.throws(() => resolveDistTag({ mode: 'dev', input: 'latest' }), /must never move latest/);
  assert.throws(() => resolveDistTag({ mode: 'release', input: 'next' }), /publish to latest only/);
});
