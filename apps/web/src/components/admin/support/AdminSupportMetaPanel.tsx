'use client';

import { useState } from 'react';
import { adminSupportApi } from '@/lib/api';
import { FieldSelect, Notice } from '@/components/ui/signal-primitives';
import { SupportStatusBadge } from '@/components/support/SupportStatusBadge';
import type { SupportThreadDetail } from '@/components/support/support.types';

interface AdminThread extends SupportThreadDetail {
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
  assignedAdmin: { id: string; name: string | null; email: string } | null;
}

interface Props {
  thread: AdminThread;
  currentUserId: string;
  locale: string;
  onThreadUpdate: (thread: AdminThread) => void;
}

const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'CLOSED'] as const;
const STATUS_LABELS: Record<string, { en: string; ru: string }> = {
  OPEN: { en: 'Open', ru: 'Открыто' },
  IN_PROGRESS: { en: 'In progress', ru: 'В работе' },
  WAITING_USER: { en: 'Waiting user', ru: 'Ожидает' },
  CLOSED: { en: 'Closed', ru: 'Закрыто' },
};

export function AdminSupportMetaPanel({ thread, currentUserId, locale, onThreadUpdate }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isAssignedToMe = thread.assignedAdmin?.id === currentUserId;

  async function handleTake() {
    setBusy(true);
    setError('');
    try {
      const result = await adminSupportApi.takeThread(thread.id);
      onThreadUpdate({ ...thread, ...(result.thread as Partial<AdminThread>) });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (locale === 'ru' ? 'Ошибка' : 'Error'));
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(status: string) {
    setBusy(true);
    setError('');
    try {
      const result = await adminSupportApi.setStatus(thread.id, { status });
      onThreadUpdate({ ...thread, ...(result.thread as Partial<AdminThread>) });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (locale === 'ru' ? 'Ошибка' : 'Error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      background: 'var(--color-bg-subtle)',
      border: '1px solid var(--color-border-soft)',
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      fontSize: '0.875rem',
    }}>
      {error && <Notice tone="danger">{error}</Notice>}

      {/* User info */}
      <div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
          {locale === 'ru' ? 'Пользователь' : 'User'}
        </div>
        <div style={{ fontWeight: 500 }}>{thread.user.name || thread.user.email}</div>
        {thread.user.name && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{thread.user.email}</div>
        )}
      </div>

      {/* Status */}
      <div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          {locale === 'ru' ? 'Статус' : 'Status'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <SupportStatusBadge status={thread.status} locale={locale} />
          <FieldSelect
            value={thread.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={busy}
            style={{ fontSize: '0.8rem', padding: '3px 8px' }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {locale === 'ru' ? STATUS_LABELS[s].ru : STATUS_LABELS[s].en}
              </option>
            ))}
          </FieldSelect>
        </div>
      </div>

      {/* Assignment */}
      <div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          {locale === 'ru' ? 'Назначен' : 'Assigned'}
        </div>
        {thread.assignedAdmin ? (
          <div style={{ fontWeight: 500 }}>
            {thread.assignedAdmin.name || thread.assignedAdmin.email}
            {isAssignedToMe && (
              <span style={{ marginLeft: '6px', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                ({locale === 'ru' ? 'вы' : 'you'})
              </span>
            )}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-faint)' }}>
            {locale === 'ru' ? 'Не назначен' : 'Unassigned'}
          </div>
        )}
        {!isAssignedToMe && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleTake}
            disabled={busy}
            style={{ marginTop: '8px' }}
          >
            {locale === 'ru' ? 'Взять в работу' : 'Take ticket'}
          </button>
        )}
      </div>

      {/* Dates */}
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', borderTop: '1px solid var(--color-border-soft)', paddingTop: '10px' }}>
        <div>{locale === 'ru' ? 'Создано: ' : 'Created: '}{new Date(thread.createdAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        <div>{locale === 'ru' ? 'Обновлено: ' : 'Updated: '}{new Date(thread.updatedAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>
    </div>
  );
}
