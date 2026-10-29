import { ActionError } from './errors.mjs';
import { STABLE_TAG_RE, assertCounter, assertDevVersion, sanitizeSha } from './semver.mjs';

export const DIST_TAG_RE = /^[A-Za-z][A-Za-z0-9._-]*$/;

function unsupportedEvent(eventName, ref) {
  return (
    `Unsupported event "${eventName}" (ref "${ref || 'none'}"). Supported: a published release, ` +
    'a push to a branch (dev), or a push of a stable vX.Y.Z tag (release).'
  );
}

/** Pick dev or release from the event, or validate an explicit mode against the event. */
export function resolveMode({ requested, eventName, eventAction, ref }) {
  const isRelease = eventName === 'release';
  const isBranchPush = eventName === 'push' && ref.startsWith('refs/heads/');
  const isTagPush = eventName === 'push' && ref.startsWith('refs/tags/');
  const isPublishedRelease = isRelease && eventAction === 'published';

  if (requested === 'auto') {
    if (isRelease) {
      if (eventAction !== 'published') {
        throw new ActionError(`Release action "${eventAction}" is not supported; only "published" publishes.`);
      }
      return 'release';
    }
    if (isTagPush) {
      return 'release';
    }
    if (isBranchPush) {
      return 'dev';
    }
    throw new ActionError(unsupportedEvent(eventName, ref));
  }

  if (requested === 'dev') {
    if (!isBranchPush) {
      throw new ActionError(
        `mode "dev" needs a push to a branch, but this run is "${eventName}" on "${ref || 'no ref'}"`,
      );
    }
    return 'dev';
  }

  if (!isPublishedRelease && !isTagPush) {
    throw new ActionError(
      `mode "release" needs a published release or a stable tag push, but this run is "${eventName}" on "${ref || 'no ref'}"`,
    );
  }
  return 'release';
}

/** Return the version for a stable tag (vX.Y.Z -> X.Y.Z); refuse anything else. */
export function versionFromStableTag(tag) {
  if (!STABLE_TAG_RE.test(tag ?? '')) {
    throw new ActionError(
      `Release tag "${tag ?? ''}" is not accepted: stable publishing requires a tag of the form vX.Y.Z ` +
        '(for example v1.4.2). Pre-release and build-metadata tags are refused.',
    );
  }
  return tag.slice(1);
}

/** Every listed package must declare exactly the release version. */
export function assertStableAgreement(packages, version) {
  const mismatches = packages.filter((pkg) => pkg.version !== version);
  if (mismatches.length > 0) {
    const declared = mismatches.map((pkg) => `${pkg.dir} declares ${pkg.version}`).join(', ');
    throw new ActionError(
      `Release tag gives version ${version} but ${declared}. Bump package.json before tagging, ` +
        'or set stamp-release-version to rewrite it from the tag.',
    );
  }
}

/** Build <base>-dev.<run>.<attempt>.<sha>. No timestamp. */
export function buildDevVersion({ base, run, attempt, rawSha }) {
  assertCounter('GITHUB_RUN_NUMBER', run);
  assertCounter('GITHUB_RUN_ATTEMPT', attempt);
  const sha = sanitizeSha(rawSha);
  return assertDevVersion(`${base}-dev.${run}.${attempt}.${sha}`);
}

/** dev publishes to dev (never latest); release publishes to latest (never anything else). */
export function resolveDistTag({ mode, input }) {
  const tag = input === '' ? (mode === 'dev' ? 'dev' : 'latest') : input;
  if (mode === 'dev' && tag === 'latest') {
    throw new ActionError('dist-tag "latest" is refused in dev mode: a dev publication must never move latest.');
  }
  if (mode === 'release' && tag !== 'latest') {
    throw new ActionError(`dist-tag "${tag}" is refused in release mode: stable releases publish to latest only.`);
  }
  if (!DIST_TAG_RE.test(tag)) {
    throw new ActionError(`dist-tag "${tag}" is not a valid npm tag name`);
  }
  return tag;
}
