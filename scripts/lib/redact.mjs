const REDACTED = '[REDACTED]';

/** Remove credential values from text that is about to be printed. */
export function redact(text) {
  return String(text)
    .replace(/_authToken=\S+/g, `_authToken=${REDACTED}`)
    .replace(/\bnpm_[A-Za-z0-9]{16,}\b/g, REDACTED)
    .replace(/(\/\/[^/\s]+\/:_authToken=)\S+/g, `$1${REDACTED}`);
}
