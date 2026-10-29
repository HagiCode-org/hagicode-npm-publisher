import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** An error whose message is meant for the caller's log, not a stack trace. */
export class ActionError extends Error {
  constructor(message, { exitCode = 1 } = {}) {
    super(message);
    this.name = 'ActionError';
    this.exitCode = exitCode;
  }
}

/** Escape text for a GitHub workflow command annotation. */
export function escapeAnnotation(text) {
  return String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/** Run an entry point, turning thrown errors into an annotation and a non-zero exit. */
export async function runMain(fn) {
  try {
    const code = await fn();
    process.exitCode = code ?? 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`::error::${escapeAnnotation(message)}\n`);
    process.stderr.write(`${message}\n`);
    process.exitCode = error?.exitCode ?? 1;
  }
}

/** True when the module at metaUrl is the script Node was asked to run. */
export function isEntry(metaUrl) {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
}
