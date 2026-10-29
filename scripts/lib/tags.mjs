import { STABLE_TAG_RE } from './semver.mjs';

/**
 * Floating major tag for a stable release tag, or null. A stable tag moves vN only when it is the
 * highest stable vN.Y.Z among the existing tags, so an older patch pushed late cannot move it back.
 * Prerelease and non-semver tags never move anything.
 */
export function floatingTagFor(ref, existingTags = []) {
  const match = STABLE_TAG_RE.exec(ref ?? '');
  if (!match) return null;
  const major = match[1];
  const candidates = [ref, ...existingTags].filter((tag) => {
    const found = STABLE_TAG_RE.exec(tag);
    return found && found[1] === major;
  });
  const highest = candidates.reduce((best, tag) => (compareStable(tag, best) > 0 ? tag : best));
  return highest === ref ? `v${major}` : null;
}

function compareStable(a, b) {
  const left = STABLE_TAG_RE.exec(a).slice(1).map(Number);
  const right = STABLE_TAG_RE.exec(b).slice(1).map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}
