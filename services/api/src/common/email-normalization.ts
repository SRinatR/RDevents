export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeOptionalEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeEmail(value);
  return normalized.length > 0 ? normalized : null;
}
