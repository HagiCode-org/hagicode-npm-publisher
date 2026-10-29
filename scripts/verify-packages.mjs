#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ActionError, runMain, isEntry } from './lib/errors.mjs';
import { run as runCommand } from './lib/exec.mjs';
import { loadPackages } from './lib/packages.mjs';
import { assertPackFiles, findLeakage, manifestProblems } from './lib/pack-rules.mjs';
import { readState, stateDir, writeState } from './lib/state.mjs';

/**
 * Gate: pack check (npm pack --dry-run --json per package), then the generic manifest rules.
 * Runs after stamping and before publish. Failing here stops the run before anything is published.
 */
export async function run(env = process.env) {
  const dir = stateDir(env);
  const { context } = readState(dir);
  if (!context?.run) {
    writeState(dir, { verification: { skipped: true } });
    return 0;
  }
  const root = env.GITHUB_WORKSPACE || process.cwd();
  const packages = loadPackages({
    root,
    workingDirectory: context.workingDirectory,
    dirs: context.packages.map((pkg) => pkg.dir),
  });
  const checked = [];

  for (const pkg of packages) {
    const cwd = path.dirname(pkg.manifestFile);
    if (context.packCheck) {
      const result = await runCommand('npm', ['pack', '--dry-run', '--json'], { cwd, env, tee: false });
      if (result.code !== 0) {
        const firstLine = result.stderr.split('\n').find((line) => line.trim() !== '') ?? 'no output';
        throw new ActionError(`npm pack --dry-run failed for ${pkg.name}: ${firstLine.trim()}`);
      }
      const files = assertPackFiles(pkg.name, JSON.parse(result.stdout));
      const leaked = findLeakage({ files, json: pkg.json });
      if (leaked.length > 0) {
        throw new ActionError(`${pkg.name} would publish files that should not ship: ${leaked.join(', ')}`);
      }
      checked.push(`${pkg.name}: ${files.length} packed files`);
    }
    if (context.verifyPackage) {
      const problems = manifestProblems({
        json: pkg.json,
        dir: pkg.dir,
        fileExists: (file) => fs.existsSync(path.join(cwd, file)),
        provenance: context.provenance,
        repository: env.GITHUB_REPOSITORY || '',
      });
      if (problems.length > 0) {
        throw new ActionError(`${pkg.name} fails the package rules: ${problems.join('; ')}`);
      }
      checked.push(`${pkg.name}: manifest rules`);
    }
  }
  writeState(dir, { verification: { skipped: false, checked } });
  return 0;
}

if (isEntry(import.meta.url)) {
  await runMain(() => run());
}
