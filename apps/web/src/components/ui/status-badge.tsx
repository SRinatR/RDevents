'use client';

interface StatusBadgeProps {
  status: string;
  type?: 'event' | 'team' | 'registration' | 'participant_role';
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PUBLISHED: { label: 'Опубликовано', color: 'text-green-800', bg: 'bg-green-50', border: 'border-green-200' },
  DRAFT: { label: 'Черновик', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
  CANCELLED: { label: 'Отменена', color: 'text-red-800', bg: 'bg-red-50', border: 'border-red-200' },
  ARCHIVED: { label: 'Архив', color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-300' },
  
  OPEN: { label: 'Открыта', color: 'text-green-800', bg: 'bg-green-50', border: 'border-green-200' },
  CLOSED: { label: 'Закрыта', color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-300' },
  FULL: { label: 'Заполнено', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  
  SUBMITTED: { label: 'Подана', color: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-200' },
  UNDER_REVIEW: { label: 'На рассмотрении', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  CONFIRMED: { label: 'Подтверждена', color: 'text-green-800', bg: 'bg-green-50', border: 'border-green-200' },
  REJECTED: { label: 'Отклонена', color: 'text-red-800', bg: 'bg-red-50', border: 'border-red-200' },
  RESERVE: { label: 'В резерве', color: 'text-purple-800', bg: 'bg-purple-50', border: 'border-purple-200' },
  WITHDRAWN: { label: 'Отозвана', color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-300' },
  
  PARTICIPANT: { label: 'Участник', color: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-200' },
  CAPTAIN: { label: 'Капитан', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  VOLUNTEER: { label: 'Волонтёр', color: 'text-green-800', bg: 'bg-green-50', border: 'border-green-200' },
  EVENT_ADMIN: { label: 'Администратор', color: 'text-purple-800', bg: 'bg-purple-50', border: 'border-purple-200' },
  ORGANIZER: { label: 'Организатор', color: 'text-purple-800', bg: 'bg-purple-50', border: 'border-purple-200' },
};

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export function StatusBadge({ status, type, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${config.color} ${config.bg} ${config.border} ${SIZE_CLASSES[size]}`}
    >
      {config.label}
    </span>
  );
}

interface RoleBadgeProps {
  role: string;
  size?: 'sm' | 'md' | 'lg';
}

export function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
  const ROLE_COLORS: Record<string, { color: string; bg: string; icon: string }> = {
    CAPTAIN: { color: 'text-amber-800', bg: 'bg-amber-50', icon: '👑' },
    MEMBER: { color: 'text-blue-800', bg: 'bg-blue-50', icon: '👤' },
    PARTICIPANT: { color: 'text-blue-800', bg: 'bg-blue-50', icon: '👤' },
    VOLUNTEER: { color: 'text-green-800', bg: 'bg-green-50', icon: '🌟' },
    EVENT_ADMIN: { color: 'text-purple-800', bg: 'bg-purple-50', icon: '⚡' },
    ORGANIZER: { color: 'text-purple-800', bg: 'bg-purple-50', icon: '⚡' },
  };

  const config = ROLE_COLORS[role] ?? { color: 'text-gray-700', bg: 'bg-gray-50', icon: '👤' };

  const ROLE_LABELS: Record<string, string> = {
    CAPTAIN: 'Капитан',
    MEMBER: 'Участник',
    PARTICIPANT: 'Участник',
    VOLUNTEER: 'Волонтёр',
    EVENT_ADMIN: 'Администратор',
    ORGANIZER: 'Организатор',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full border ${config.color} ${config.bg} ${SIZE_CLASSES[size]}`}
    >
      <span>{config.icon}</span>
      <span>{ROLE_LABELS[role] ?? role}</span>
    </span>
  );
}