import path from 'node:path';
import { ActionError } from './errors.mjs';

/** Default value of every action input. Mirrors action.yml; a contract test keeps them equal. */
export const DEFAULTS = Object.freeze({
  mode: 'auto',
  'package-manager': 'auto',
  'node-version': '24',
  'working-directory': '.',
  packages: '.',
  provenance: 'true',
  access: 'public',
  'dist-tag': '',
  'registry-url': 'https://registry.npmjs.org',
  'base-version': '',
  'expected-repository': '',
  'expected-workflow': '.github/workflows/npm-publish.yml',
  'install-command': 'auto',
  'typecheck-command': '',
  'build-command': '',
  'test-command': '',
  'after-version-command': '',
  'registry-neutrality-command': '',
  'verify-command': '',
  'pack-check': 'true',
  'verify-package': 'true',
  'verify-lockfile-stable': 'true',
  'skip-existing': 'true',
  summary: 'true',
  'stamp-release-version': 'false',
  'dry-run': 'false',
});

export const INPUT_NAMES = Object.freeze(Object.keys(DEFAULTS));

const ENUMS = {
  mode: ['auto', 'dev', 'release'],
  'package-manager': ['auto', 'pnpm', 'npm'],
  access: ['public', 'restricted'],
};

const BOOLEANS = [
  'provenance',
  'pack-check',
  'verify-package',
  'verify-lockfile-stable',
  'skip-existing',
  'summary',
  'stamp-release-version',
  'dry-run',
];

/** Read raw INPUT_* values. An input whose variable is absent falls back to its default. */
export function readRawInputs(env) {
  const raw = {};
  for (const name of INPUT_NAMES) {
    const value = env[`INPUT_${name.toUpperCase()}`];
    raw[name] = value === undefined ? DEFAULTS[name] : value;
  }
  return raw;
}

/** Split a newline-separated list, dropping blank lines. */
export function normalizeList(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function normalizeWorkingDirectory(value) {
  const normalized = path.posix.normalize(String(value).trim().replace(/\\/g, '/') || '.');
  if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
    throw new ActionError(`working-directory "${value}" must be a relative path inside the repository`);
  }
  return normalized;
}

function normalizePackages(text) {
  const entries = normalizeList(text);
  return entries.length === 0 ? ['.'] : entries;
}

function parseBoolean(name, value) {
  if (value !== 'true' && value !== 'false') {
    throw new ActionError(`Invalid ${name} "${value}". Accepted values: true, false.`);
  }
  return value === 'true';
}

/** Validate and normalise every input. Throws ActionError with the accepted values on failure. */
export function parseInputs(env = {}) {
  const raw = readRawInputs(env);

  for (const [name, allowed] of Object.entries(ENUMS)) {
    const value = raw[name].trim();
    if (!allowed.includes(value)) {
      throw new ActionError(`Invalid ${name} "${value}". Accepted values: ${allowed.join(', ')}.`);
    }
    raw[name] = value;
  }

  let registryUrl;
  try {
    registryUrl = new URL(raw['registry-url'].trim());
  } catch {
    throw new ActionError(`Invalid registry-url "${raw['registry-url']}": expected an absolute http(s) URL.`);
  }
  if (registryUrl.protocol !== 'https:' && registryUrl.protocol !== 'http:') {
    throw new ActionError(`Invalid registry-url "${raw['registry-url']}": only http(s) is supported.`);
  }

  if (raw['node-version'].trim() === '') {
    throw new ActionError('node-version must not be empty.');
  }

  const commandOf = (name) => raw[name].trim();

  return {
    mode: raw.mode,
    packageManager: raw['package-manager'],
    nodeVersion: raw['node-version'].trim(),
    workingDirectory: normalizeWorkingDirectory(raw['working-directory']),
    packages: normalizePackages(raw.packages),
    provenance: parseBoolean('provenance', raw.provenance),
    access: raw.access,
    distTag: raw['dist-tag'].trim(),
    registryUrl: registryUrl.toString().replace(/\/$/, ''),
    baseVersion: raw['base-version'].trim(),
    expectedRepository: raw['expected-repository'].trim(),
    expectedWorkflow: raw['expected-workflow'].trim(),
    installCommand: commandOf('install-command'),
    typecheckCommand: commandOf('typecheck-command'),
    buildCommand: commandOf('build-command'),
    testCommand: commandOf('test-command'),
    afterVersionCommand: commandOf('after-version-command'),
    registryNeutralityCommand: commandOf('registry-neutrality-command'),
    verifyCommand: commandOf('verify-command'),
    packCheck: parseBoolean('pack-check', raw['pack-check']),
    verifyPackage: parseBoolean('verify-package', raw['verify-package']),
    verifyLockfileStable: parseBoolean('verify-lockfile-stable', raw['verify-lockfile-stable']),
    skipExisting: parseBoolean('skip-existing', raw['skip-existing']),
    summary: parseBoolean('summary', raw.summary),
    stampReleaseVersion: parseBoolean('stamp-release-version', raw['stamp-release-version']),
    dryRun: parseBoolean('dry-run', raw['dry-run']),
  };
}
