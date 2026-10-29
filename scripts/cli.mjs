#!/usr/bin/env node
/**
 * Maintainer entry point (not published to npm).
 *   node scripts/cli.mjs resolve [--root <dir>]            print the resolved context as JSON (dry-run style)
 *   node scripts/cli.mjs check-dist-tags --package <name> --latest <version> [--dev <version>] [--registry <url>]
 *       exit 1 unless latest equals --latest and, when --dev is given, dev equals --dev
 */
import { resolveContext } from './lib/context.mjs';
import { ActionError, runMain, isEntry } from './lib/errors.mjs';
import { run as runCommand } from './lib/exec.mjs';

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    if (!key?.startsWith('--')) throw new ActionError(`unexpected argument "${key}"`);
    options[key.slice(2)] = rest[i + 1];
  }
  return { command, options };
}

export async function main(argv, env = process.env) {
  const { command, options } = parseArgs(argv);

  if (command === 'resolve') {
    const context = resolveContext({ env, root: options.root || process.cwd() });
    process.stdout.write(`${JSON.stringify(context, null, 2)}\n`);
    return 0;
  }

  if (command === 'check-dist-tags') {
    if (!options.package || !options.latest) {
      throw new ActionError('check-dist-tags needs --package and --latest');
    }
    const result = await runCommand(
      'npm',
      ['view', options.package, 'dist-tags', '--json', '--registry', options.registry || 'https://registry.npmjs.org'],
      { env, tee: false },
    );
    if (result.code !== 0) {
      throw new ActionError(`could not read dist-tags for ${options.package}: ${result.stderr.trim()}`);
    }
    const tags = JSON.parse(result.stdout);
    const problems = [];
    if (tags.latest !== options.latest) {
      problems.push(`latest is ${tags.latest}, expected ${options.latest}`);
    }
    if (options.dev && tags.dev !== options.dev) {
      problems.push(`dev is ${tags.dev}, expected ${options.dev}`);
    }
    if (problems.length > 0) {
      process.stdout.write(`${options.package}: ${problems.join('; ')}\n`);
      return 1;
    }
    process.stdout.write(`${options.package}: latest ${tags.latest}${options.dev ? `, dev ${tags.dev}` : ''}\n`);
    return 0;
  }

  throw new ActionError('usage: cli.mjs resolve [--root dir] | check-dist-tags --package name --latest version [--dev version]');
}

if (isEntry(import.meta.url)) {
  await runMain(() => main(process.argv.slice(2)));
}
