'use client';

// Typed API client for the web app.
// All requests go through this module — no raw fetch() in pages/components.

const rawBaseUrl =
  process.env['NEXT_PUBLIC_API_BASE_URL']
  ?? (process.env['NODE_ENV'] === 'development' ? 'http://localhost:4000' : 'https://api.rdevents.uz');

const BASE_URL = rawBaseUrl.replace(/\/$/, '');

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

async function requestForm<T>(path: string, formData: FormData, auth = false): Promise<T> {
  const headers: Record<string, string> = {};

  if (auth && _accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(res.status, data.error ?? 'Request failed', data.details);
  }

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  startRegistration: (body: { email: string }) =>
    request<{ ok: boolean; expiresAt: string; cooldownSeconds: number; devCode?: string }>('/api/auth/register/start', { method: 'POST', body }),

  verifyRegistrationCode: (body: { email: string; code: string }) =>
    request<{ registrationToken: string; expiresAt: string }>('/api/auth/register/verify', { method: 'POST', body }),

  completeRegistration: (body: { email: string; registrationToken: string; password: string; name?: string }) =>
    request<{ user: any; accessToken: string }>('/api/auth/register/complete', { method: 'POST', body }),

  login: (body: { email: string; password: string }) =>
    request<{ user: any; accessToken: string }>('/api/auth/login', { method: 'POST', body }),

  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', auth: true }),

  refresh: () =>
    request<{ accessToken: string }>('/api/auth/refresh', { method: 'POST' }),

  me: () =>
    request<{ user: any }>('/api/auth/me', { auth: true }),

  updateProfile: (body: {
    name?: string;
    bio?: string;
    city?: string;
    factualAddress?: string;
    phone?: string;
    telegram?: string;
    nativeLanguage?: string;
    communicationLanguage?: string;
    consentPersonalData?: boolean;
    consentClientRules?: boolean;
    birthDate?: string;
    avatarUrl?: string;
    lastNameCyrillic?: string;
    firstNameCyrillic?: string;
    middleNameCyrillic?: string;
    lastNameLatin?: string;
    firstNameLatin?: string;
    middleNameLatin?: string;
    hasNoLastName?: boolean;
    hasNoFirstName?: boolean;
    hasNoMiddleName?: boolean;
  }) =>
    request<{ user: any }>('/api/auth/profile', { method: 'PATCH', auth: true, body }),

  getProfileSections: () =>
    request<{ sections: any[] }>('/api/auth/profile/sections', { auth: true }),

  updateProfileSection: (sectionKey: string, body: Record<string, unknown>) =>
    request<any>(`/api/auth/profile/sections/${sectionKey}`, { method: 'PATCH', auth: true, body }),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestForm<any>('/api/auth/profile/avatar/upload', formData, true);
  },

  deleteAvatar: () =>
    request<{ ok: boolean }>('/api/auth/profile/avatar', { method: 'DELETE', auth: true }),

  listProfileDocuments: () =>
    request<{ documents: any[] }>('/api/auth/profile/documents', { auth: true }),

  uploadProfileDocument: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestForm<any>('/api/auth/profile/documents/upload', formData, true);
  },

  deleteProfileDocument: (assetId: string) =>
    request<{ ok: boolean }>(`/api/auth/profile/documents/${assetId}`, { method: 'DELETE', auth: true }),

  loginWithGoogle: (payload: { providerAccountId: string; providerEmail?: string; providerUsername?: string }) =>
    request<{ user: any; accessToken: string }>('/api/auth/google', { method: 'POST', body: payload }),

  loginWithYandex: (payload: { providerAccountId: string; providerEmail?: string; providerUsername?: string }) =>
    request<{ user: any; accessToken: string }>('/api/auth/yandex', { method: 'POST', body: payload }),

  loginWithTelegram: (payload: { providerAccountId: string; providerEmail?: string; providerUsername?: string }) =>
    request<{ user: any; accessToken: string }>('/api/auth/telegram', { method: 'POST', body: payload }),
};

// ─── Reference Data ──────────────────────────────────────────────────────────

export const referenceApi = {
  countries: () =>
    request<{ data: any[] }>('/api/reference/countries', { auth: true }),

  uzRegions: () =>
    request<{ data: any[] }>('/api/reference/uz/regions', { auth: true }),

  uzDistricts: (regionId?: string) => {
    const qs = regionId ? '?' + new URLSearchParams({ regionId }).toString() : '';
    return request<{ data: any[] }>(`/api/reference/uz/districts${qs}`, { auth: true });
  },

  uzSettlements: (districtId?: string) => {
    const qs = districtId ? '?' + new URLSearchParams({ districtId }).toString() : '';
    return request<{ data: any[] }>(`/api/reference/uz/settlements${qs}`, { auth: true });
  },
};

// ─── Events ───────────────────────────────────────────────────────────────────

export const eventsApi = {
  list: (params?: Record<string, string | number>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/events${qs}`, { auth: true });
  },

  get: (slug: string) =>
    request<{ event: any }>(`/api/events/${slug}`, { auth: true }),

  register: (eventId: string, answers?: Record<string, unknown>) =>
    request<{ status: string; membership?: any; message?: string; participantCount?: number; participantTarget?: number | null }>(`/api/events/${eventId}/register`, { method: 'POST', auth: true, body: { answers: answers ?? {} } }),

  registrationPrecheck: (eventId: string, answers?: Record<string, unknown>) =>
    request<{ precheck: any }>(`/api/events/${eventId}/registration/precheck`, { method: 'POST', auth: true, body: { answers: answers ?? {} } }),

  saveRegistrationAnswers: (eventId: string, answers: Record<string, unknown>) =>
    request<{ answers: any }>(`/api/events/${eventId}/registration-answers`, { method: 'PATCH', auth: true, body: { answers } }),

  unregister: (eventId: string) =>
    request<{ membership: any }>(`/api/events/${eventId}/register`, { method: 'DELETE', auth: true }),

  membership: (eventId: string) =>
    request<{ membership: any }>(`/api/events/${eventId}/membership`, { auth: true }),

  applyVolunteer: (eventId: string, notes?: string) =>
    request<{ membership: any }>(`/api/events/${eventId}/volunteer-application`, { method: 'POST', auth: true, body: { notes } }),

  myVolunteerApplication: (eventId: string) =>
    request<{ volunteerApplication: any }>(`/api/events/${eventId}/volunteer-application/me`, { auth: true }),

  listTeams: (eventId: string) =>
    request<{ teams: any[] }>(`/api/events/${eventId}/teams`, { auth: true }),

  getTeam: (eventId: string, teamId: string) =>
    request<{ team: any }>(`/api/events/${eventId}/teams/${teamId}`, { auth: true }),

  createTeam: (eventId: string, body: { name: string; description?: string; answers?: Record<string, unknown> }) =>
    request<{ team: any }>(`/api/events/${eventId}/teams`, { method: 'POST', auth: true, body }),

  updateTeam: (eventId: string, teamId: string, body: { name?: string; description?: string }) =>
    request<{ team: any }>(`/api/events/${eventId}/teams/${teamId}`, { method: 'PATCH', auth: true, body }),

  submitTeamForApproval: (eventId: string, teamId: string) =>
    request<{ team: any }>(`/api/events/${eventId}/teams/${teamId}/submit`, { method: 'POST', auth: true }),

  getTeamSlots: (eventId: string, teamId: string) =>
    request<any>(`/api/events/${eventId}/teams/${teamId}/slots`, { auth: true }),

  inviteToTeamByEmail: (eventId: string, teamId: string, body: { slotIndex: number; email: string; message?: string }) =>
    request<{ invitation: any }>(`/api/events/${eventId}/teams/${teamId}/invitations`, { method: 'POST', auth: true, body }),

  cancelTeamInvitation: (eventId: string, teamId: string, invitationId: string) =>
    request<{ ok: boolean; invitation: any }>(`/api/events/${eventId}/teams/${teamId}/invitations/${invitationId}`, { method: 'DELETE', auth: true }),

  joinTeam: (eventId: string, teamId: string, code?: string, answers?: Record<string, unknown>) =>
    request<{ member: any }>(`/api/events/${eventId}/teams/${teamId}/join`, { method: 'POST', auth: true, body: { code, answers: answers ?? {} } }),

  joinTeamByCode: (eventId: string, code: string, answers?: Record<string, unknown>) =>
    request<{ member: any }>(`/api/events/${eventId}/teams/join-by-code`, { method: 'POST', auth: true, body: { code, answers: answers ?? {} } }),

  removeTeamMember: (eventId: string, teamId: string, userId: string) =>
    request<{ ok: boolean; team: any }>(`/api/events/${eventId}/teams/${teamId}/members/${userId}`, { method: 'DELETE', auth: true }),

  transferTeamCaptain: (eventId: string, teamId: string, userId: string) =>
    request<{ ok: boolean; team: any }>(`/api/events/${eventId}/teams/${teamId}/members/${userId}/transfer-captain`, { method: 'POST', auth: true }),

  myEvents: () =>
    request<{ events: any[] }>('/api/me/events', { auth: true }),

  myApplications: () =>
    request<{ applications: any[] }>('/api/me/applications', { auth: true }),

  myEventWorkspace: (slug: string) =>
    request<{ event: any }>(`/api/me/events/${slug}/workspace`, { auth: true }),

  myTeams: () =>
    request<{ teams: any[] }>('/api/me/teams', { auth: true }),

  myTeamInvitations: () =>
    request<{ invitations: any[] }>('/api/me/team-invitations', { auth: true }),

  acceptTeamInvitation: (invitationId: string) =>
    request<{ invitation: any; member: any }>(`/api/me/team-invitations/${invitationId}/accept`, { method: 'POST', auth: true }),

  declineTeamInvitation: (invitationId: string) =>
    request<{ invitation: any }>(`/api/me/team-invitations/${invitationId}/decline`, { method: 'POST', auth: true }),

  myVolunteerApplications: () =>
    request<{ applications: any[] }>('/api/me/volunteer-applications', { auth: true }),
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

  uploadEventCover: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestForm<{ publicUrl: string; storageKey: string }>('/api/uploads/event-cover', formData, true);
  },

  deleteEvent: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/events/${id}`, { method: 'DELETE', auth: true }),

  listEventAdmins: (eventId: string) =>
    request<{ eventAdmins: any[] }>(`/api/admin/events/${eventId}/admins`, { auth: true }),

  assignEventAdmin: (eventId: string, body: { userId?: string; email?: string; notes?: string }) =>
    request<{ membership: any }>(`/api/admin/events/${eventId}/admins`, { method: 'POST', auth: true, body }),

  removeEventAdmin: (eventId: string, userId: string) =>
    request<{ ok: boolean }>(`/api/admin/events/${eventId}/admins/${userId}`, { method: 'DELETE', auth: true }),

  listEventVolunteers: (eventId: string, status?: string) => {
    const qs = status ? '?' + new URLSearchParams({ status }).toString() : '';
    return request<{ volunteers: any[] }>(`/api/admin/events/${eventId}/volunteers${qs}`, { auth: true });
  },

  updateVolunteerStatus: (eventId: string, memberId: string, body: { status: string; notes?: string }) =>
    request<{ membership: any }>(`/api/admin/events/${eventId}/volunteers/${memberId}`, { method: 'PATCH', auth: true, body }),

  listEventParticipants: (eventId: string) =>
    request<{ participants: any[] }>(`/api/admin/events/${eventId}/participants`, { auth: true }),

  listEventMembers: (eventId: string) =>
    request<{ members: any[] }>(`/api/admin/events/${eventId}/members`, { auth: true }),

  updateParticipantStatus: (eventId: string, memberId: string, body: { status: string; notes?: string }) =>
    request<{ membership: any }>(`/api/admin/participants/events/${eventId}/participants/${memberId}`, { method: 'PATCH', auth: true, body }),

  listEventTeams: (eventId: string) =>
    request<{ teams: any[] }>(`/api/admin/events/${eventId}/teams`, { auth: true }),

  approveEventTeamMember: (eventId: string, teamId: string, userId: string) =>
    request<{ member: any }>(`/api/events/${eventId}/teams/${teamId}/members/${userId}/approve`, { method: 'POST', auth: true }),

  rejectEventTeamMember: (eventId: string, teamId: string, userId: string) =>
    request<{ ok: boolean }>(`/api/events/${eventId}/teams/${teamId}/members/${userId}/reject`, { method: 'POST', auth: true }),

  removeEventTeamMember: (eventId: string, teamId: string, userId: string) =>
    request<{ ok: boolean }>(`/api/events/${eventId}/teams/${teamId}/members/${userId}`, { method: 'DELETE', auth: true }),

  approveTeamChangeRequest: (eventId: string, teamId: string, requestId: string, notes?: string) =>
    request<{ team: any }>(`/api/admin/events/${eventId}/teams/${teamId}/change-requests/${requestId}/approve`, { method: 'POST', auth: true, body: { notes } }),

  rejectTeamChangeRequest: (eventId: string, teamId: string, requestId: string, notes?: string) =>
    request<{ team: any }>(`/api/admin/events/${eventId}/teams/${teamId}/change-requests/${requestId}/reject`, { method: 'POST', auth: true, body: { notes } }),

  getEventAnalytics: (eventId: string) =>
    request<any>(`/api/admin/events/${eventId}/analytics`, { auth: true }),

  // Unified endpoints - no N+1 queries
  listParticipants: (params?: {
    search?: string;
    eventId?: string;
    role?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/admin/participants${qs}`, { auth: true });
  },

  listApplications: (params?: {
    search?: string;
    eventId?: string;
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/admin/applications${qs}`, { auth: true });
  },

  listTeams: (params?: {
    search?: string;
    eventId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/admin/teams${qs}`, { auth: true });
  },

  listUsers: (params?: Record<string, string | number>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/admin/users${qs}`, { auth: true });
  },

  updateUserRole: (id: string, role: string) =>
    request<{ user: any }>(`/api/admin/users/${id}/role`, { method: 'PATCH', auth: true, body: { role } }),

  listAdmins: () =>
    request<{ admins: any[]; platformAdmins: any[]; eventAdmins: any[] }>('/api/admin/admins', { auth: true }),

  listVolunteers: () =>
    request<{ volunteers: any[] }>('/api/admin/volunteers', { auth: true }),

  getAnalytics: () =>
    request<any>('/api/admin/analytics', { auth: true }),
};

// ─── Admin Email ──────────────────────────────────────────────────────────────

export const adminEmailApi = {
  getOverview: () =>
    request<any>('/api/admin/email/overview', { auth: true }),

  listMessages: (params: Record<string, string | number> = {}) => {
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/admin/email/messages${qs}`, { auth: true });
  },

  listTemplates: (params: Record<string, string | number> = {}) => {
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/admin/email/templates${qs}`, { auth: true });
  },

  listBroadcasts: (params: Record<string, string | number> = {}) => {
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/admin/email/broadcasts${qs}`, { auth: true });
  },

  listAutomations: (params: Record<string, string | number> = {}) => {
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/admin/email/automations${qs}`, { auth: true });
  },

  getAudience: () =>
    request<any>('/api/admin/email/audience', { auth: true }),

  listDomains: (params: Record<string, string | number> = {}) => {
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/admin/email/domains${qs}`, { auth: true });
  },

  getWebhooks: () =>
    request<any>('/api/admin/email/webhooks', { auth: true }),
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export const analyticsApi = {
  track: (type: string, payload?: Record<string, unknown>) =>
    fetch(`${BASE_URL}/api/analytics/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(_accessToken ? { Authorization: `Bearer ${_accessToken}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ type, ...payload }),
    }).catch(() => {}), // fire-and-forget, never throw
};

export const supportApi = {
  listThreads: (params?: { page?: number; limit?: number; status?: string }) => {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()
      : '';
    return request<{ data: any[]; meta: any }>(`/api/support/threads${qs}`, { auth: true });
  },

  createThread: (body: { subject: string }) =>
    request<{ thread: any }>('/api/support/threads', { method: 'POST', auth: true, body }),

  deleteEmptyThread: (threadId: string) =>
    request<{ deleted?: boolean; skipped?: boolean }>(`/api/support/threads/${threadId}/empty`, { method: 'DELETE', auth: true }),

  getThread: (threadId: string) =>
    request<{ thread: any }>(`/api/support/threads/${threadId}`, { auth: true }),

  sendMessage: (threadId: string, body: { body: string; attachmentIds?: string[] }) =>
    request<{ message: any }>(`/api/support/threads/${threadId}/messages`, { method: 'POST', auth: true, body }),

  uploadAttachments: (threadId: string, files: File[]) => {
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    return requestForm<{ attachments: any[] }>(`/api/support/threads/${threadId}/attachments`, formData, true);
  },

  markRead: (threadId: string) =>
    request<{ ok: boolean }>(`/api/support/threads/${threadId}/read`, { method: 'POST', auth: true }),
};

// ─── Admin Support ────────────────────────────────────────────────────────────

export const adminSupportApi = {
  listThreads: (params?: { page?: number; limit?: number; status?: string; assignedAdminId?: string; unassigned?: boolean }) => {
    const entries = Object.entries(params ?? {})
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]);
    const qs = entries.length ? '?' + new URLSearchParams(entries).toString() : '';
    return request<{ data: any[]; meta: any }>(`/api/admin/support/threads${qs}`, { auth: true });
  },

  getThread: (threadId: string) =>
    request<{ thread: any }>(`/api/admin/support/threads/${threadId}`, { auth: true }),

  reply: (threadId: string, body: { body: string; attachmentIds?: string[] }) =>
    request<{ message: any }>(`/api/admin/support/threads/${threadId}/reply`, { method: 'POST', auth: true, body }),

  takeThread: (threadId: string) =>
    request<{ thread: any }>(`/api/admin/support/threads/${threadId}/take`, { method: 'POST', auth: true }),

  assignThread: (threadId: string, body: { adminUserId: string }) =>
    request<{ thread: any }>(`/api/admin/support/threads/${threadId}/assign`, { method: 'POST', auth: true, body }),

  setStatus: (threadId: string, body: { status: string }) =>
    request<{ thread: any }>(`/api/admin/support/threads/${threadId}/status`, { method: 'POST', auth: true, body }),

  markRead: (threadId: string) =>
    request<{ ok: boolean }>(`/api/admin/support/threads/${threadId}/read`, { method: 'POST', auth: true }),

  uploadAttachments: (threadId: string, files: File[]) => {
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    return requestForm<{ attachments: any[] }>(`/api/admin/support/threads/${threadId}/attachments`, formData, true);
  },
};
