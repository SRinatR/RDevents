'use client';

import { ApiError, getAccessToken, type EventMediaItem } from './api';

const rawBaseUrl =
  process.env['NEXT_PUBLIC_API_BASE_URL']
  ?? (process.env['NODE_ENV'] === 'development' ? 'http://localhost:4000' : 'https://api.rdevents.uz');

const BASE_URL = rawBaseUrl.replace(/\/$/, '');

export type EventMediaAlbum = {
  id: string;
  eventId: string;
  title: string;
  description?: string | null;
  coverMediaId?: string | null;
  sortOrder: number;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  mediaCount: number;
  cover?: {
    mediaId: string;
    publicUrl?: string | null;
    storageKey?: string | null;
    mimeType?: string | null;
  } | null;
};

async function albumRequest<T>(path: string, options: { method?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

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

export const adminMediaAlbumsApi = {
  list: (eventId: string) =>
    albumRequest<{ albums: EventMediaAlbum[] }>(`/api/admin/events/${eventId}/media/albums`),

  create: (eventId: string, body: { title: string; description?: string; sortOrder?: number }) =>
    albumRequest<{ album: EventMediaAlbum }>(`/api/admin/events/${eventId}/media/albums`, { method: 'POST', body }),

  update: (eventId: string, albumId: string, body: { title?: string; description?: string; sortOrder?: number; coverMediaId?: string | null }) =>
    albumRequest<{ album: EventMediaAlbum }>(`/api/admin/events/${eventId}/media/albums/${albumId}`, { method: 'PATCH', body }),

  remove: (eventId: string, albumId: string) =>
    albumRequest<{ ok: boolean }>(`/api/admin/events/${eventId}/media/albums/${albumId}`, { method: 'DELETE' }),

  assignMedia: (eventId: string, albumId: string, mediaIds: string[]) =>
    albumRequest<{ ok: boolean; movedCount: number; album: EventMediaAlbum }>(`/api/admin/events/${eventId}/media/albums/${albumId}/media`, { method: 'POST', body: { mediaIds } }),

  unassignMedia: (eventId: string, mediaIds: string[]) =>
    albumRequest<{ ok: boolean; movedCount: number; album: null }>(`/api/admin/events/${eventId}/media/albums/unassigned/media`, { method: 'POST', body: { mediaIds } }),
};

export type EventMediaAlbumAssignableItem = EventMediaItem;
