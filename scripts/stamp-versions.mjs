#!/usr/bin/env node
import path from 'node:path';
import { loadPackages, stampPackages, writeManifests } from './lib/packages.mjs';
import { assertDevVersion } from './lib/semver.mjs';
import { runMain, isEntry } from './lib/errors.mjs';
import { assertStableAgreement } from './lib/version.mjs';
import { readState, stateDir, writeState } from './lib/state.mjs';

/**
 * Step 2: write the resolved version into the listed manifests (dev always, release only when
 * stamp-release-version is set). Runs before the caller hook and before any gate that reads versions.
 */
export async function run(env = process.env) {
  const dir = stateDir(env);
  const { context } = readState(dir);
  if (!context?.run) {
    writeState(dir, { stamp: { stamped: false, warnings: [], rewrites: [] } });
    return 0;
  }
  const root = env.GITHUB_WORKSPACE || process.cwd();
  const packages = loadPackages({
    root,
    workingDirectory: context.workingDirectory,
    dirs: context.packages.map((pkg) => pkg.dir),
  });

  if (context.mode === 'release' && !context.stampReleaseVersion) {
    assertStableAgreement(packages, context.version);
    writeState(dir, { stamp: { stamped: false, warnings: [], rewrites: [] } });
    return 0;
  }
  if (context.mode === 'dev') {
    assertDevVersion(context.version);
  }

  const { warnings, rewrites } = stampPackages({ packages, version: context.version });
  writeManifests(packages);

  const reread = loadPackages({
    root,
    workingDirectory: context.workingDirectory,
    dirs: context.packages.map((pkg) => pkg.dir),
  });
  if (context.mode === 'release') {
    assertStableAgreement(reread, context.version);
  }
  for (const warning of warnings) {
    console.log(`::warning::${warning}`);
  }
  writeState(dir, { stamp: { stamped: true, version: context.version, warnings, rewrites } });
  console.log(`Stamped ${packages.map((pkg) => `${pkg.name}@${context.version}`).join(', ')} (${path.posix.join(context.workingDirectory)})`);
  return 0;
}

if (isEntry(import.meta.url)) {
  await runMain(() => run());
}
