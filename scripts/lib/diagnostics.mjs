import { redact } from './redact.mjs';

export { redact };

/** Classify combined npm output. Order follows the spec: E404, E403, E401/ENEEDAUTH, provenance, unknown. */
export function classifyFailure(output) {
  const text = String(output);
  if (/\bE404\b|404 Not Found/.test(text)) return 'E404';
  if (/\bE403\b|403 Forbidden|cannot publish over (?:the )?previously published/i.test(text)) return 'E403';
  if (/\bE401\b|ENEEDAUTH|401 Unauthorized/.test(text)) return 'E401';
  if (/provenance|repository\.url/i.test(text)) return 'provenance';
  return 'unknown';
}

/** Scope of a scoped package name: the part before the slash. */
export function scopeOf(packageName) {
  return packageName.startsWith('@') ? packageName.split('/')[0] : null;
}

/** Actionable checks, built only from runtime values (package, repository, workflow file). */
export function guidanceFor({ cls, packageName, repository, workflowFile, oidcPresent }) {
  const trustedPublisher =
    `the trusted publisher for "${packageName}" on npmjs.com must name owner/repository "${repository}", ` +
    `workflow filename "${workflowFile}" and the environment (if one is used)`;
  switch (cls) {
    case 'E404': {
      const scope = scopeOf(packageName);
      return [
        scope
          ? `Confirm that the npm scope "${scope}" exists and that the publishing identity can create or update "${packageName}".`
          : `Confirm that "${packageName}" exists on the registry and that the publishing identity can create or update it.`,
        `Confirm that ${trustedPublisher}.`,
      ];
    }
    case 'E403':
      return [
        'npm refused the write (E403). A version that is already published cannot be published again: check the version in package.json.',
        `Confirm that ${trustedPublisher}.`,
      ];
    case 'E401':
      if (!oidcPresent) {
        return ['The job has no OIDC request variables. Grant "id-token: write" at job or workflow level.'];
      }
      return [`Authentication failed although OIDC variables are present: ${trustedPublisher}.`];
    case 'provenance':
      return [
        `Compare repository.url in the package.json of "${packageName}" with the GitHub repository "${repository}".`,
        `Confirm that ${trustedPublisher}.`,
      ];
    default:
      return [
        `Read the npm output above. Check that "${packageName}" has the expected version and access settings.`,
        `Check that ${trustedPublisher}.`,
        'The exit status below is the one npm returned.',
      ];
  }
}

/** Text block printed to stderr and written to the job summary. Contains no credentials. */
export function renderDiagnostics({ cls, packageName, repository, workflowFile, oidcPresent }) {
  const lines = [
    `npm publish failed for ${packageName} (class ${cls}).`,
    ...guidanceFor({ cls, packageName, repository, workflowFile, oidcPresent }).map((line) => `- ${line}`),
  ];
  return redact(`${lines.join('\n')}\n`);
}

/** Workflow filename from GITHUB_WORKFLOW_REF, e.g. ".github/workflows/npm-publish.yml". */
export function workflowFileOf(workflowRef, repository) {
  const prefix = `${repository}/`;
  if (!workflowRef.startsWith(prefix)) return workflowRef;
  return workflowRef.slice(prefix.length).split('@')[0];
}
