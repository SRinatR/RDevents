import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function normalizeReleaseSha(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function resolveReleaseSha() {
  const fromEnv = normalizeReleaseSha(process.env['RELEASE_SHA']);
  if (fromEnv) return fromEnv;

  const candidateFiles = [
    process.env['RELEASE_SHA_FILE'],
    resolve(process.cwd(), 'release.txt'),
    resolve(process.cwd(), '.release-commit'),
  ].filter(Boolean) as string[];

  for (const file of candidateFiles) {
    try {
      const fromFile = normalizeReleaseSha(readFileSync(file, 'utf8'));
      if (fromFile) return fromFile;
    } catch {
      // Missing release files are expected in local dev.
    }
  }

  return 'unknown';
}

export const releaseSha = resolveReleaseSha();
