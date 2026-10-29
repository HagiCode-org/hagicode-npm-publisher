#!/usr/bin/env node
import path from 'node:path';
import { runMain, isEntry } from './lib/errors.mjs';
import { assertOidcEnvironment, preflightNpm, run as runCommand } from './lib/exec.mjs';
import { classifyFailure, guidanceFor, redact, workflowFileOf } from './lib/diagnostics.mjs';
import { listVersions, hasVersion } from './lib/registry.mjs';
import { readState, stateDir, writeState } from './lib/state.mjs';

const idOf = (pkg) => `${pkg.name}@${pkg.version}`;

/** Build the npm publish argument list for one package. */
export function publishArgs(context) {
  const args = ['publish', '--tag', context.distTag, '--access', context.access, '--registry', context.registryUrl];
  if (context.provenance) args.push('--provenance');
  return args;
}

/**
 * Step 3: publish in the listed order. Dry run publishes nothing and makes no registry call.
 * Existing versions are skipped; the first failure stops the loop so dependents never go out.
 */
export async function run(env = process.env, { runCommandFn = runCommand } = {}) {
  const dir = stateDir(env);
  const { context } = readState(dir);
  if (!context?.run) {
    writeState(dir, { publish: { published: [], skipped: [], notAttempted: [], failure: null, planned: [] } });
    return 0;
  }
  const root = env.GITHUB_WORKSPACE || process.cwd();
  const packages = context.packages;
  const planned = packages.map(idOf);

  if (context.dryRun) {
    writeState(dir, { publish: { dryRun: true, published: [], skipped: [], notAttempted: [], failure: null, planned } });
    console.log(`Dry run: would publish ${planned.join(', ')} to ${context.distTag}; npm publish not invoked.`);
    return 0;
  }

  assertOidcEnvironment(env);
  await preflightNpm({ runCommand: runCommandFn, env });

  const published = [];
  const skipped = [];
  const repositoryName = context.repository;
  const workflowFile = workflowFileOf(context.workflowRef, repositoryName);

  for (let index = 0; index < packages.length; index += 1) {
    const pkg = packages[index];
    const id = idOf(pkg);
    const fail = (cls, extra = {}) => {
      const guidance = guidanceFor({
        cls,
        packageName: pkg.name,
        repository: repositoryName,
        workflowFile,
        oidcPresent: true,
      }).map(redact);
      const failure = {
        name: pkg.name,
        version: pkg.version,
        distTag: context.distTag,
        class: cls,
        guidance,
        ...extra,
      };
      const notAttempted = packages.slice(index + 1).map(idOf);
      writeState(dir, { publish: { published, skipped, notAttempted, failure, planned } });
      return failure;
    };

    if (context.skipExisting) {
      let versions;
      try {
        versions = await listVersions({ name: pkg.name, registryUrl: context.registryUrl, run: runCommandFn });
      } catch (error) {
        const failure = fail('registry', { message: redact(error.message) });
        console.error(redact(error.message));
        console.log(`::error title=npm publish failed::${failure.name}@${failure.version}: registry query failed`);
        return error.exitCode ?? 1;
      }
      if (hasVersion(versions, pkg.version)) {
        skipped.push(id);
        console.log(`Skipping ${id}: already in the registry.`);
        continue;
      }
    }

    const cwd = path.join(root, context.workingDirectory, pkg.dir);
    const result = await runCommandFn('npm', publishArgs(context), { cwd, env });
    if (result.code === 0) {
      published.push(id);
      continue;
    }

    const cls = classifyFailure(`${result.stdout}\n${result.stderr}`);
    const failure = fail(cls, { exitCode: result.code });
    for (const line of failure.guidance) {
      console.error(`- ${line}`);
    }
    console.log(`::error title=npm publish failed::${pkg.name}@${pkg.version} (${cls})`);
    return result.code || 1;
  }

  writeState(dir, { publish: { published, skipped, notAttempted: [], failure: null, planned } });
  return 0;
}

if (isEntry(import.meta.url)) {
  await runMain(() => run());
}

