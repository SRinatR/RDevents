'use client';

import { ApiError, getAccessToken, type AdminMediaUpdate, type EventMediaImportJob } from './api';

const rawBaseUrl =
  process.env['NEXT_PUBLIC_API_BASE_URL']
  ?? (process.env['NODE_ENV'] === 'development' ? 'http://localhost:4000' : 'https://api.rdevents.uz');

const BASE_URL = rawBaseUrl.replace(/\/$/, '');

async function jsonRequest<T>(path: string, options: { method?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    cache: 'no-store',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(res.status, data.error ?? 'Request failed', data.details, data.code);
  }

  return res.json() as Promise<T>;
}

export const mediaBankAdminApi = {
  updateImport: (eventId: string, jobId: string, body: { status?: EventMediaImportJob['status']; errorMessage?: string | null }) =>
    jsonRequest<{ job: EventMediaImportJob }>(`/api/admin/events/${eventId}/media/imports/${jobId}`, { method: 'PATCH', body }),

  deleteImport: (eventId: string, jobId: string, options: { deleteImportedMedia?: boolean } = {}) =>
    jsonRequest<{ ok: boolean; deletedImport: boolean; deletedMediaCount: number }>(
      `/api/admin/events/${eventId}/media/imports/${jobId}?deleteImportedMedia=${options.deleteImportedMedia ? 'true' : 'false'}`,
      { method: 'DELETE' },
    ),

  rollbackImport: (eventId: string, jobId: string) =>
    jsonRequest<{ ok: boolean; rolledBack: boolean; deletedMediaCount: number }>(`/api/admin/events/${eventId}/media/imports/${jobId}/rollback`, { method: 'POST' }),

  bulkUpdateMedia: (eventId: string, mediaIds: string[], patch: AdminMediaUpdate) =>
    jsonRequest<{ ok: boolean; updatedCount: number }>(`/api/admin/events/${eventId}/media/bulk`, { method: 'PATCH', body: { mediaIds, patch } }),
};
