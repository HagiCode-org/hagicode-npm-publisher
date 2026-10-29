import { spawn } from 'node:child_process';
import { ActionError } from './errors.mjs';
import { redact } from './redact.mjs';

/** Minimum npm CLI for npm trusted publishing (npm docs: "npm CLI version 11.5.1 or later"). */
export const MIN_NPM_VERSION = '11.5.1';

/** Compare dotted numeric versions. Returns negative, zero or positive. */
export function compareVersions(a, b) {
  const left = String(a).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const right = String(b).split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Spawn a command without a shell (except Windows .cmd shims). Output is captured and, when tee is
 * set, echoed live with credential values redacted.
 */
export function run(command, args = [], { cwd, env = process.env, tee = true, input } = {}) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const executable = isWindows && !command.endsWith('.exe') ? `${command}.cmd` : command;
    const child = spawn(executable, args, {
      cwd,
      env,
      shell: isWindows,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const teeLines = (target) => {
      let pending = '';
      return (chunk) => {
        pending += chunk.toString();
        const lines = pending.split('\n');
        pending = lines.pop();
        for (const line of lines) target.write(`${redact(line)}\n`);
      };
    };
    const teeOut = tee ? teeLines(process.stdout) : null;
    const teeErr = tee ? teeLines(process.stderr) : null;

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      teeOut?.(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      teeErr?.(chunk);
    });
    child.on('error', (error) => {
      resolve({ code: 127, stdout, stderr: `${stderr}${error.message}\n`, signal: null });
    });
    child.on('close', (code, signal) => {
      resolve({ code: code ?? 1, stdout, stderr, signal });
    });
    if (input !== undefined) {
      child.stdin.end(input);
    }
  });
}

/** Read the installed npm CLI version and refuse anything below the trusted-publishing minimum. */
export async function preflightNpm({ runCommand = run, minimum = MIN_NPM_VERSION, env } = {}) {
  const result = await runCommand('npm', ['--version'], { env, tee: false });
  const version = result.stdout.trim();
  if (result.code !== 0 || !/^\d+\.\d+\.\d+/.test(version)) {
    throw new ActionError(`could not read the npm CLI version (exit ${result.code}); npm must be on PATH`);
  }
  if (compareVersions(version, minimum) < 0) {
    throw new ActionError(
      `npm ${version} is older than ${minimum}, the minimum for npm trusted publishing. ` +
        `Add a step before this action that runs "npm install -g npm@latest" (or otherwise installs npm >= ${minimum}) and rerun.`,
    );
  }
  return version;
}

/** Trusted publishing needs the runner's OIDC request variables, which exist only with id-token: write. */
export function assertOidcEnvironment(env) {
  const missing = ['ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN'].filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new ActionError(
      `npm trusted publishing needs an OIDC identity, but ${missing.join(' and ')} are not set. ` +
        'Grant "id-token: write" in the caller job or workflow permissions, then rerun.',
    );
  }
}
