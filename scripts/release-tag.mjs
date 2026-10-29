#!/usr/bin/env node
import fs from 'node:fs';
import { floatingTagFor } from './lib/tags.mjs';
import { runMain, isEntry } from './lib/errors.mjs';

/**
 * Print `major=vN` to stdout (for $GITHUB_OUTPUT) when the pushed tag should move the floating major
 * tag; print nothing otherwise. Input: REF_NAME and an optional TAGS_FILE with one existing tag per line.
 */
export function run(env = process.env) {
  const existing = env.TAGS_FILE && fs.existsSync(env.TAGS_FILE)
    ? fs.readFileSync(env.TAGS_FILE, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean)
    : [];
  const major = floatingTagFor(env.REF_NAME ?? '', existing);
  if (major) {
    process.stdout.write(`major=${major}\n`);
  } else {
    console.error(`No floating tag for ${env.REF_NAME ?? '(none)'}: only the highest stable tag of a major moves it.`);
  }
  return 0;
}

if (isEntry(import.meta.url)) {
  await runMain(() => run());
}
