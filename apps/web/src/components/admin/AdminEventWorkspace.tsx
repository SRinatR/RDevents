import type { ReactNode } from 'react';
import Link from 'next/link';
import { EmptyState, PageHeader } from '@/components/ui/signal-primitives';

export type AdminEventRecord = {
  id: string;
  title: string;
  slug?: string | null;
  status?: string | null;
  category?: string | null;
  location?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  registrationOpensAt?: string | null;
  registrationDeadline?: string | null;
  capacity?: number | null;
  registrationsCount?: number | null;
  _count?: { registrations?: number };
};

export function eventStatusTone(status?: string | null): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'DRAFT') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'COMPLETED') return 'info';
  return 'neutral';
}

export function memberStatusTone(status?: string | null): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'RESERVE') return 'info';
  if (status === 'REJECTED' || status === 'CANCELLED' || status === 'REMOVED') return 'danger';
  return 'neutral';
}

export function formatAdminDate(value?: string | null, locale = 'ru') {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  } catch {
    return '—';
  }
}

export function formatAdminDateTime(value?: string | null, locale = 'ru') {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch {
    return '—';
  }
}

export function EventWorkspaceHeader({
  event,
  locale,
  title,
  subtitle,
  actions,
}: {
  event: AdminEventRecord | null;
  locale: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <PageHeader
      title={title}
      subtitle={subtitle ?? event?.title ?? ''}
      actions={(
        <div className="admin-event-page-actions">
          {actions}
          {event?.slug ? <Link href={`/${locale}/events/${event.slug}`} className="btn btn-ghost btn-sm">{locale === 'ru' ? 'Публичная' : 'Public'}</Link> : null}
          {event?.id ? <Link href={`/${locale}/admin/events/${event.id}/edit`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Редактировать' : 'Edit'}</Link> : null}
        </div>
      )}
    />
  );
}

export function EventNotFound({ locale }: { locale: string }) {
  return (
    <div className="signal-page-shell admin-control-page">
      <EmptyState
        title={locale === 'ru' ? 'Событие не найдено' : 'Event not found'}
        description={locale === 'ru' ? 'Проверьте выбор события или вернитесь к реестру.' : 'Check the selected event or return to the registry.'}
        actions={<Link href={`/${locale}/admin/events`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'К событиям' : 'Back to events'}</Link>}
      />
    </div>
  );
}
