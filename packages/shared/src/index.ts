// Shared types and utilities used by both web and api packages.
// Keep this minimal — only truly shared contracts belong here.

export type UserRole = 'USER' | 'PLATFORM_ADMIN' | 'SUPER_ADMIN';
export type AuthProvider = 'EMAIL' | 'GOOGLE' | 'YANDEX' | 'TELEGRAM';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
export type EventMemberRole = 'PARTICIPANT' | 'VOLUNTEER' | 'EVENT_ADMIN';
export type EventMemberStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'REMOVED';

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  bio?: string | null;
  city?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  isActive: boolean;
  registeredAt: string;
  lastLoginAt?: string | null;
  accounts?: Array<{
    provider: AuthProvider;
    providerEmail?: string | null;
    linkedAt: string;
  }>;
  eventRoles?: Array<{
    eventId: string;
    eventSlug: string;
    eventTitle: string;
    role: EventMemberRole;
    status: EventMemberStatus;
  }>;
}

export interface EventSummary {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  coverImageUrl?: string | null;
  category: string;
  location: string;
  capacity: number;
  registrationsCount: number;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  isFeatured: boolean;
  isRegistered?: boolean;
}

export interface EventDetail extends EventSummary {
  fullDescription: string;
  publishedAt?: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string; avatarUrl?: string | null } | null;
}

export interface EventMembershipRecord {
  memberId: string;
  role: EventMemberRole;
  status: EventMemberStatus;
  joinedAt: string;
  event: EventSummary;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface AuthResponse {
  user: UserPublic;
  accessToken: string;
}

export * from './profile/profile-field-registry.js';
