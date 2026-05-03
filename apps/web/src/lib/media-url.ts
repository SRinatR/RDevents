const rawApiBase =
  process.env['NEXT_PUBLIC_API_BASE_URL']
  ?? (process.env['NODE_ENV'] === 'production'
    ? 'https://api.rdevents.uz'
    : 'http://localhost:4000');

const API_BASE_URL = rawApiBase.replace(/\/$/, '');

export function resolveMediaUrl(url?: string | null, storageKey?: string | null) {
  if (!url && !storageKey) return null;

  if (url?.startsWith('http://') || url?.startsWith('https://')) {
    return url;
  }

  if (url?.startsWith('/')) {
    return `${API_BASE_URL}${url}`;
  }

  if (url) {
    return `${API_BASE_URL}/${url}`;
  }

  if (storageKey) {
    return `${API_BASE_URL}/uploads/${storageKey.replace(/^\/+/, '')}`;
  }

  return null;
}

export function shouldDisableNextImageOptimization(url?: string | null) {
  if (!url) return false;

  return (
    process.env['NODE_ENV'] === 'development'
    || url.includes('localhost:4000')
    || url.includes('127.0.0.1:4000')
    || url.includes('0.0.0.0:4000')
  );
}
