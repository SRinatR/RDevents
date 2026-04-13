'use client';

// Typed API client for the web app.
// All requests go through this module — no raw fetch() in pages/components.

const BASE_URL = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:4000';

// Access token is stored in memory (rehydrated from a cookie-based refresh on page load)
let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken() {
  return _accessToken;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth && _accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include', // send cookies (refresh token)
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(res.status, data.error ?? 'Request failed', data.details);
  }

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: { email: string; password: string; name: string }) =>
    request<{ user: any; accessToken: string }>('/api/auth/register', { method: 'POST', body }),

  login: (body: { email: string; password: string }) =>
    request<{ user: any; accessToken: string }>('/api/auth/login', { method: 'POST', body }),

  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', auth: true }),

  refresh: () =>
    request<{ accessToken: string }>('/api/auth/refresh', { method: 'POST' }),

  me: () =>
    request<{ user: any }>('/api/auth/me', { auth: true }),

  updateProfile: (body: { name?: string; bio?: string; city?: string; phone?: string; avatarUrl?: string }) =>
    request<{ user: any }>('/api/auth/profile', { method: 'PATCH', auth: true, body }),

  loginWithGoogle: (payload: { providerAccountId: string; providerEmail?: string; providerUsername?: string }) =>
    request<{ user: any; accessToken: string }>('/api/auth/google', { method: 'POST', body: payload }),

  loginWithYandex: (payload: { providerAccountId: string; providerEmail?: string; providerUsername?: string }) =>
    request<{ user: any; accessToken: string }>('/api/auth/yandex', { method: 'POST', body: payload }),

  loginWithTelegram: (payload: { providerAccountId: string; providerEmail?: string; providerUsername?: string }) =>
    request<{ user: any; accessToken: string }>('/api/auth/telegram', { method: 'POST', body: payload }),
};

// ─── Events ───────────────────────────────────────────────────────────────────

export const eventsApi = {
  list: (params?: Record<string, string | number>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/events${qs}`, { auth: true });
  },

  get: (slug: string) =>
    request<{ event: any }>(`/api/events/${slug}`, { auth: true }),

  register: (eventId: string) =>
    request<{ registration: any }>(`/api/events/${eventId}/register`, { method: 'POST', auth: true }),

  applyVolunteer: (eventId: string, notes?: string) =>
    request<{ membership: any }>(`/api/events/${eventId}/volunteer/apply`, { method: 'POST', auth: true, body: { notes } }),

  myEvents: () =>
    request<{ events: any[] }>('/api/me/events', { auth: true }),
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminApi = {
  listEvents: (params?: Record<string, string | number>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/admin/events${qs}`, { auth: true });
  },

  createEvent: (body: Record<string, unknown>) =>
    request<{ event: any }>('/api/admin/events', { method: 'POST', auth: true, body }),

  updateEvent: (id: string, body: Record<string, unknown>) =>
    request<{ event: any }>(`/api/admin/events/${id}`, { method: 'PATCH', auth: true, body }),

  deleteEvent: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/events/${id}`, { method: 'DELETE', auth: true }),

  listEventAdmins: (eventId: string) =>
    request<{ eventAdmins: any[] }>(`/api/admin/events/${eventId}/event-admins`, { auth: true }),

  assignEventAdmin: (eventId: string, body: { userId?: string; email?: string; notes?: string }) =>
    request<{ membership: any }>(`/api/admin/events/${eventId}/event-admins`, { method: 'POST', auth: true, body }),

  listEventVolunteers: (eventId: string, status?: string) => {
    const qs = status ? '?' + new URLSearchParams({ status }).toString() : '';
    return request<{ volunteers: any[] }>(`/api/admin/events/${eventId}/volunteers${qs}`, { auth: true });
  },

  updateVolunteerStatus: (eventId: string, memberId: string, body: { status: string; notes?: string }) =>
    request<{ membership: any }>(`/api/admin/events/${eventId}/volunteers/${memberId}`, { method: 'PATCH', auth: true, body }),

  listEventParticipants: (eventId: string) =>
    request<{ participants: any[] }>(`/api/admin/events/${eventId}/participants`, { auth: true }),

  getEventAnalytics: (eventId: string) =>
    request<any>(`/api/admin/events/${eventId}/analytics`, { auth: true }),

  listUsers: (params?: Record<string, string | number>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/admin/users${qs}`, { auth: true });
  },

  updateUserRole: (id: string, role: string) =>
    request<{ user: any }>(`/api/admin/users/${id}/role`, { method: 'PATCH', auth: true, body: { role } }),

  listAdmins: () =>
    request<{ admins: any[] }>('/api/admin/admins', { auth: true }),

  listVolunteers: () =>
    request<{ volunteers: any[] }>('/api/admin/volunteers', { auth: true }),

  getAnalytics: () =>
    request<any>('/api/admin/analytics', { auth: true }),
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export const analyticsApi = {
  track: (type: string, payload?: Record<string, unknown>) =>
    fetch(`${BASE_URL}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type, ...payload }),
    }).catch(() => {}), // fire-and-forget, never throw
};
