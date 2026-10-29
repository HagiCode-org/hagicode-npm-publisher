import { ActionError } from './errors.mjs';

/** Stable release tag: vX.Y.Z, no prerelease, no build metadata. Groups: major, minor, patch. */
export const STABLE_TAG_RE = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const CORE_VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
/** Strict SemVer 2.0.0. */
export const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
/** Digits without leading zeros: a valid numeric SemVer identifier. */
export const COUNTER_RE = /^(0|[1-9]\d*)$/;
/** The SHA component: all-digit values must carry the g prefix. */
export const SHA_COMPONENT_RE = /^(?:g[0-9]{1,7}|(?=.*[a-z])[0-9a-z]{1,7})$/;

export function isStrictSemver(version) {
  return typeof version === 'string' && SEMVER_RE.test(version);
}

/** The X.Y.Z core of a strict SemVer version, dropping any prerelease or build part. */
export function coreOf(version) {
  if (!isStrictSemver(version)) {
    throw new ActionError(`"${version}" is not a valid SemVer version`);
  }
  return /^(\d+\.\d+\.\d+)/.exec(version)[1];
}

export function assertCoreVersion(value, label) {
  if (!CORE_VERSION_RE.test(value)) {
    throw new ActionError(`${label} must be a plain X.Y.Z version, got "${value}"`);
  }
  return value;
}

export function assertCounter(label, value) {
  if (!COUNTER_RE.test(value)) {
    throw new ActionError(`${label} must be decimal digits without leading zeros, got "${value}"`);
  }
  return value;
}

/**
 * Clean a commit SHA for use as a SemVer identifier: lowercase, strip everything outside [0-9a-z],
 * keep the first 7 characters, then prefix "g" when the result is all digits. The prefix is applied
 * after slicing, so a short all-digit input is prefixed too.
 */
export function sanitizeSha(raw) {
  const cleaned = String(raw).toLowerCase().replace(/[^0-9a-z]/g, '').slice(0, 7);
  if (cleaned.length === 0) {
    throw new ActionError(
      `GITHUB_SHA ("${raw}") has no alphanumeric characters after cleaning, so no dev version can be built`,
    );
  }
  return /^[0-9]+$/.test(cleaned) ? `g${cleaned}` : cleaned;
}

/** Self-check run before anything is written: the version must be strict SemVer with the dev shape. */
export function assertDevVersion(version) {
  if (!SEMVER_RE.test(version)) {
    throw new ActionError(`dev version "${version}" is not valid SemVer; nothing was written`);
  }
  const dashIndex = version.indexOf('-');
  const identifiers = version.slice(dashIndex + 1).split('.');
  if (identifiers.length !== 4 || identifiers[0] !== 'dev') {
    throw new ActionError(`dev version "${version}" must have the form X.Y.Z-dev.<run>.<attempt>.<sha>`);
  }
  if (!COUNTER_RE.test(identifiers[1]) || !COUNTER_RE.test(identifiers[2])) {
    throw new ActionError(`dev version "${version}" has a run or attempt that is not a valid numeric identifier`);
  }
  if (!SHA_COMPONENT_RE.test(identifiers[3])) {
    throw new ActionError(
      `dev version "${version}" has an unsafe SHA component "${identifiers[3]}": an all-digit SHA must carry the g prefix`,
    );
  }
  return version;
}
