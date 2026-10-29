import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir as tmpdirOf } from 'node:os';
import { writeOutputs } from '../../scripts/lib/summary.mjs';

test('multi-line outputs are written with a heredoc, single-line outputs as key=value', () => {
  const dir = fs.mkdtempSync(path.join(tmpdirOf(), 'npm-publisher-out-'));
  const file = path.join(dir, 'out');
  writeOutputs(file, { version: '1.0.0', 'published-packages': '["a@1.0.0"]', note: 'line1\nline2' });
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^version=1\.0\.0$/m);
  assert.match(text, /^published-packages=\["a@1\.0\.0"\]$/m);
  assert.match(text, /^note<<EOF_[0-9a-f-]+\nline1\nline2\nEOF_/m);
  fs.rmSync(dir, { recursive: true, force: true });
});
