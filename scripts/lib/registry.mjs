import { ActionError } from './errors.mjs';
import { run as defaultRun } from './exec.mjs';

/** Parse the output of `npm view <name> versions --json`: a string, an array, or nothing. */
export function parseVersions(stdout) {
  const text = String(stdout).trim();
  if (text === '') return [];
  const value = JSON.parse(text);
  if (value === null) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.map(String);
  throw new ActionError(`unexpected output from npm view: ${text.slice(0, 120)}`);
}

export function isNotFound(output) {
  return /\bE404\b/.test(output);
}

/**
 * Published versions of a package. E404 means "no versions yet"; any other failure throws,
 * so a network or 5xx error is never mistaken for an absent version.
 */
export async function listVersions({ name, registryUrl, run = defaultRun }) {
  const result = await run('npm', ['view', name, 'versions', '--json', '--registry', registryUrl], {
    tee: false,
  });
  if (result.code === 0) {
    return parseVersions(result.stdout);
  }
  if (isNotFound(`${result.stdout}\n${result.stderr}`)) {
    return [];
  }
  const firstLine = `${result.stderr}`.split('\n').find((line) => line.trim() !== '') ?? 'no output';
  throw new ActionError(`registry query for ${name} failed (exit ${result.code}): ${firstLine.trim()}`);
}

export function hasVersion(versions, version) {
  return versions.includes(version);
}
