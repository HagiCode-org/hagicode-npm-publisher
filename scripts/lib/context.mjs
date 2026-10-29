import fs from 'node:fs';
import path from 'node:path';
import { ActionError } from './errors.mjs';
import { parseInputs } from './inputs.mjs';
import { loadPackages } from './packages.mjs';
import { assertCoreVersion, coreOf } from './semver.mjs';
import { redact } from './redact.mjs';
import {
  assertStableAgreement,
  buildDevVersion,
  resolveDistTag,
  resolveMode,
  versionFromStableTag,
} from './version.mjs';

export function readEvent(eventPath) {
  if (!eventPath || !fs.existsSync(eventPath)) return {};
  return JSON.parse(fs.readFileSync(eventPath, 'utf8'));
}

/**
 * Refuse a run that is not the expected repository or workflow file. npm trusted publishing is bound
 * to the workflow filename, so a mismatch would fail later with a less useful message.
 */
export function checkRepositoryAndWorkflow({ repository, workflowRef, expectedRepository, expectedWorkflow, dryRun }) {
  if (expectedRepository && repository !== expectedRepository) {
    throw new ActionError(
      `this job runs in "${repository}" but expected-repository is "${expectedRepository}"; refusing to publish from another repository`,
    );
  }
  if (!workflowRef) {
    if (dryRun) return;
    throw new ActionError('GITHUB_WORKFLOW_REF is not set; the workflow file cannot be validated');
  }
  const pinned = expectedRepository || repository;
  const expectedPrefix = `${pinned}/${expectedWorkflow}@`;
  if (!workflowRef.startsWith(expectedPrefix)) {
    const actualFile = workflowRef.startsWith(`${pinned}/`)
      ? workflowRef.slice(pinned.length + 1).split('@')[0]
      : workflowRef;
    throw new ActionError(
      `the job runs from "${actualFile}" but expected-workflow is "${expectedWorkflow}". ` +
        'npm trusted publishing is bound to the workflow filename, so publish only from the configured file.',
    );
  }
}

/**
 * Resolve everything the later steps need, from inputs and the GitHub environment. Draft and
 * prerelease releases return run=false (a success, not a failure). Nothing is written here.
 */
export function resolveContext({ env = process.env, root = env.GITHUB_WORKSPACE || process.cwd() } = {}) {
  const inputs = parseInputs(env);
  const eventName = env.GITHUB_EVENT_NAME || '';
  const ref = env.GITHUB_REF || '';
  const event = readEvent(env.GITHUB_EVENT_PATH);
  const release = eventName === 'release' ? event.release || {} : null;
  const eventAction = event.action || '';

  if (release && (release.draft || release.prerelease)) {
    const kind = release.draft ? 'draft' : 'prerelease';
    return {
      run: false,
      skipReason: `Release ${release.tag_name || '(untagged)'} is a ${kind}; it is not published by this action.`,
      eventName,
      eventAction,
      ref,
      mode: '',
      version: '',
      distTag: '',
      packageManager: '',
      defaultInstallCommand: '',
      dryRun: inputs.dryRun,
      warnings: [],
    };
  }

  const mode = resolveMode({ requested: inputs.mode, eventName, eventAction, ref });
  const repository = env.GITHUB_REPOSITORY || '';
  const workflowRef = env.GITHUB_WORKFLOW_REF || '';
  checkRepositoryAndWorkflow({
    repository,
    workflowRef,
    expectedRepository: inputs.expectedRepository,
    expectedWorkflow: inputs.expectedWorkflow,
    dryRun: inputs.dryRun,
  });

  const packages = loadPackages({ root, workingDirectory: inputs.workingDirectory, dirs: inputs.packages });
  const warnings = [];
  let version;
  let tag = '';

  if (mode === 'release') {
    tag = release ? release.tag_name || '' : env.GITHUB_REF_NAME || '';
    version = versionFromStableTag(tag);
    if (!inputs.stampReleaseVersion) {
      assertStableAgreement(packages, version);
    }
    if (inputs.baseVersion) {
      warnings.push('base-version is ignored in release mode; the release tag decides the version');
    }
  } else {
    const base = inputs.baseVersion
      ? assertCoreVersion(inputs.baseVersion, 'base-version')
      : coreOf(packages[0].version);
    version = buildDevVersion({
      base,
      run: env.GITHUB_RUN_NUMBER || '0',
      attempt: env.GITHUB_RUN_ATTEMPT || '1',
      rawSha: env.GITHUB_SHA || 'local',
    });
  }

  const distTag = resolveDistTag({ mode, input: inputs.distTag });
  const packageManager =
    inputs.packageManager === 'auto'
      ? fs.existsSync(path.join(root, inputs.workingDirectory, 'pnpm-lock.yaml'))
        ? 'pnpm'
        : 'npm'
      : inputs.packageManager;
  const defaultInstallCommand = packageManager === 'pnpm' ? 'pnpm install --frozen-lockfile' : 'npm ci';

  return {
    run: true,
    skipReason: '',
    eventName,
    eventAction,
    ref,
    mode,
    tag,
    version,
    distTag,
    packageManager,
    defaultInstallCommand,
    installCommand: inputs.installCommand === 'auto' ? defaultInstallCommand : inputs.installCommand,
    repository,
    workflowRef: redact(workflowRef),
    expectedRepository: inputs.expectedRepository,
    expectedWorkflow: inputs.expectedWorkflow,
    workingDirectory: inputs.workingDirectory,
    // Every listed package publishes the resolved version (linked release), not its pre-stamp manifest version.
    packages: packages.map(({ dir, name }) => ({ dir, name, version })),
    provenance: inputs.provenance,
    access: inputs.access,
    registryUrl: inputs.registryUrl,
    dryRun: inputs.dryRun,
    skipExisting: inputs.skipExisting,
    stampReleaseVersion: inputs.stampReleaseVersion,
    packCheck: inputs.packCheck,
    verifyPackage: inputs.verifyPackage,
    verifyLockfileStable: inputs.verifyLockfileStable,
    summary: inputs.summary,
    warnings,
  };
}
