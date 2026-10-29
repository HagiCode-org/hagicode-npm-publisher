import fs from 'node:fs';
import path from 'node:path';
import { ActionError } from './errors.mjs';
import { isStrictSemver } from './semver.mjs';

export const DEPENDENCY_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies'];

/** Normalise a packages entry; it must stay inside working-directory. */
export function normalizeDir(dir) {
  const normalized = path.posix.normalize(String(dir).trim().replace(/\\/g, '/') || '.');
  if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
    throw new ActionError(`packages entry "${dir}" must be a relative directory inside working-directory`);
  }
  return normalized;
}

function detectIndent(text) {
  const match = /\n([ \t]+)"/.exec(text);
  return match ? match[1] : '  ';
}

/**
 * Load the ordered manifests. Order is the caller's order and is never re-sorted.
 * Rejects missing manifests, private packages, duplicate names and invalid versions.
 */
export function loadPackages({ root, workingDirectory, dirs }) {
  const base = path.join(root, workingDirectory);
  const seen = new Map();
  const packages = [];

  for (const rawDir of dirs) {
    const dir = normalizeDir(rawDir);
    const manifestFile = path.join(base, dir, 'package.json');
    if (!fs.existsSync(manifestFile)) {
      throw new ActionError(`package manifest not found: ${path.posix.join(workingDirectory, dir, 'package.json')}`);
    }
    const text = fs.readFileSync(manifestFile, 'utf8');
    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new ActionError(`${dir}/package.json is not valid JSON: ${error.message}`);
    }
    if (typeof json.name !== 'string' || json.name === '') {
      throw new ActionError(`${dir}/package.json has no "name"`);
    }
    if (json.private === true) {
      throw new ActionError(`package "${json.name}" (${dir}) is private and cannot be published; remove it from packages`);
    }
    if (!isStrictSemver(json.version)) {
      throw new ActionError(`package "${json.name}" (${dir}) has no valid SemVer "version": ${json.version ?? 'missing'}`);
    }
    if (seen.has(json.name)) {
      throw new ActionError(`package "${json.name}" is listed twice (${seen.get(json.name)} and ${dir})`);
    }
    seen.set(json.name, dir);
    packages.push({
      dir,
      name: json.name,
      version: json.version,
      manifestFile,
      indent: detectIndent(text),
      json,
    });
  }
  return packages;
}

/**
 * Apply one version to every listed package. Exact pins among listed packages follow the release;
 * other specifiers that target a listed package stay unchanged and produce a warning.
 * Works in memory only; writeManifests persists it.
 */
export function stampPackages({ packages, version }) {
  const previous = new Map(packages.map((pkg) => [pkg.name, pkg.version]));
  const warnings = [];
  const rewrites = [];

  for (const pkg of packages) {
    for (const field of DEPENDENCY_FIELDS) {
      const deps = pkg.json[field];
      if (!deps || typeof deps !== 'object') continue;
      for (const [depName, spec] of Object.entries(deps)) {
        if (!previous.has(depName) || depName === pkg.name) continue;
        const oldVersion = previous.get(depName);
        if (spec === oldVersion) {
          deps[depName] = version;
          rewrites.push(`${pkg.name} ${field}.${depName}: ${oldVersion} -> ${version}`);
        } else {
          warnings.push(
            `${pkg.name} ${field}.${depName} is "${spec}" and was left unchanged; only an exact pin (${oldVersion}) is rewritten`,
          );
        }
      }
    }
    pkg.json.version = version;
  }
  return { warnings, rewrites };
}

export function writeManifests(packages) {
  for (const pkg of packages) {
    fs.writeFileSync(pkg.manifestFile, `${JSON.stringify(pkg.json, null, pkg.indent)}\n`);
  }
}
