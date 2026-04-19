'use client';

import type { SupportThread } from './support.types';

type Status = SupportThread['status'];

const STATUS_CONFIG: Record<Status, { ru: string; en: string; bg: string; color: string }> = {
  OPEN: { ru: 'Открыт', en: 'Open', bg: 'var(--color-info-subtle)', color: 'var(--color-info)' },
  IN_PROGRESS: { ru: 'В работе', en: 'In progress', bg: 'var(--color-warning-subtle)', color: 'var(--color-warning)' },
  WAITING_USER: { ru: 'Ответьте', en: 'Reply needed', bg: 'var(--color-success-subtle)', color: 'var(--color-success)' },
  CLOSED: { ru: 'Закрыт', en: 'Closed', bg: 'rgba(82,96,120,0.1)', color: 'var(--color-text-muted)' },
};

export function SupportStatusBadge({ status, locale }: { status: Status; locale: string }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 500,
      background: cfg.bg,
      color: cfg.color,
      flexShrink: 0,
    }}>
      {locale === 'ru' ? cfg.ru : cfg.en}
    </span>
  );
}
