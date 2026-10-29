import { ActionError } from './errors.mjs';

/** Paths that should never ship, whatever the package's own rules say. */
const LEAK_RULES = [
  { label: 'test files', test: (file) => /^(test|tests|__tests__)\//.test(file) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) },
  { label: 'coverage output', test: (file) => /^coverage\//.test(file) },
  { label: 'temporary directories', test: (file) => /^(\.tmp|\.vitest-temp)\//.test(file) },
  { label: 'scripts', test: (file) => /^scripts\//.test(file) },
  { label: 'src', test: (file) => /^src\//.test(file) },
];

/** Entry points named in the manifest; a file they reference is never reported as leakage. */
export function referencedEntryPoints(json) {
  const refs = new Set();
  for (const field of ['main', 'module', 'types', 'typings']) {
    if (typeof json[field] === 'string') refs.add(normalizeRef(json[field]));
  }
  if (typeof json.bin === 'string') refs.add(normalizeRef(json.bin));
  if (json.bin && typeof json.bin === 'object') {
    for (const value of Object.values(json.bin)) refs.add(normalizeRef(value));
  }
  return refs;
}

function normalizeRef(value) {
  return String(value).replace(/^\.\//, '');
}

/** Files in the pack list that match a leakage rule and are not an entry point. */
export function findLeakage({ files, json }) {
  const entry = referencedEntryPoints(json);
  const leaked = [];
  for (const file of files) {
    if (entry.has(file)) continue;
    const rule = LEAK_RULES.find((candidate) => candidate.test(file));
    if (rule) leaked.push(`${file} (${rule.label})`);
  }
  return leaked;
}

/** Generic manifest rules: entry points exist on disk; provenance needs a matching repository.url. */
export function manifestProblems({ json, dir, fileExists, provenance, repository }) {
  const problems = [];
  for (const field of ['main', 'module', 'types', 'typings']) {
    if (typeof json[field] === 'string' && !fileExists(json[field])) {
      problems.push(`${field} points to ${json[field]}, which does not exist in ${dir}`);
    }
  }
  const binValues = typeof json.bin === 'string' ? [json.bin] : Object.values(json.bin ?? {});
  for (const value of binValues) {
    if (typeof value === 'string' && !fileExists(value)) {
      problems.push(`bin points to ${value}, which does not exist in ${dir}`);
    }
  }
  if (provenance) {
    const url = typeof json.repository === 'string' ? json.repository : json.repository?.url;
    if (!url) {
      problems.push('repository.url is missing, but provenance is enabled');
    } else if (repository && !url.toLowerCase().includes(`github.com/${repository.toLowerCase()}`)) {
      problems.push(`repository.url "${url}" does not point to github.com/${repository}; npm provenance would fail`);
    }
  }
  return problems;
}

export function assertPackFiles(name, entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new ActionError(`npm pack --dry-run --json returned no entry for ${name}`);
  }
  const files = entries[0].files?.map((file) => file.path) ?? [];
  if (files.length === 0) {
    throw new ActionError(`npm pack --dry-run lists no files for ${name}; check the "files" field`);
  }
  return files;
}
