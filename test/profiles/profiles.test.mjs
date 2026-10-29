import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GOLDEN } from '../support/goldens.mjs';
import { listProfiles, loadProfile, replayProfile } from '../support/profiles.mjs';

for (const name of listProfiles()) {
  test(`caller profile ${name} replays in dry-run and matches its golden resolved context`, () => {
    const profile = loadProfile(name);
    assert.ok(profile.description, 'every profile states what it reproduces');
    const replay = replayProfile(name);
    assert.deepEqual(replay.failures, [], `a step failed: ${JSON.stringify(replay.failures)}`);
    assert.equal(replay.publishCalls, 0, 'dry-run must never call npm publish');
    assert.equal(replay.outputs.published, 'false');

    const golden = JSON.parse(fs.readFileSync(path.join(GOLDEN, 'resolved', `${name}.json`), 'utf8'));
    assert.deepEqual({ context: replay.context, outputs: replay.outputs, planned: replay.planned }, golden);
  });
}

test('the seven existing callers each have a profile', () => {
  assert.deepEqual(listProfiles(), ['cli', 'hagi-release-drafter', 'hagi18n', 'hagilight', 'hagiscript', 'hagitask', 'imgbin']);
});
