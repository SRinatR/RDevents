function normalize(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function getWebReleaseSha() {
  return (
    normalize(process.env['NEXT_PUBLIC_RELEASE_SHA']) ??
    normalize(process.env['RELEASE_SHA']) ??
    'local'
  );
}

export function getWebReleasePayload() {
  return {
    service: 'event-platform-web',
    releaseSha: getWebReleaseSha(),
    environment: process.env['NODE_ENV'] ?? 'unknown',
  };
}