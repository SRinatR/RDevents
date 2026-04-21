'use client';

import Link from 'next/link';
import { ToolbarRow } from '@/components/ui/signal-primitives';
import { SupportStatusBadge } from '@/components/support/SupportStatusBadge';
import type { SupportThread } from '@/components/support/support.types';

function truncate(text: string, max = 80) {
  return text.length <= max ? text : text.slice(0, max) + '…';
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function UnreadDot() {
  return (
    <span style={{
      display: 'inline-block',
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: 'var(--color-warning)',
      flexShrink: 0,
    }} aria-label="unread" />
  );
}

interface AdminThread extends SupportThread {
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
  assignedAdmin: { id: string; name: string | null; email: string } | null;
}

export function AdminSupportThreadCard({ thread, locale }: { thread: AdminThread; locale: string }) {
  return (
    <Link
      href={`/${locale}/admin/support/${thread.id}`}
      className="signal-ranked-item cabinet-list-item workspace-event-journey-item"
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <strong>{thread.subject}</strong>
          {thread.hasUnread && <UnreadDot />}
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {thread.user.name || thread.user.email}
          </span>
        </div>
        {thread.lastMessage && (
          <div className="signal-muted" style={{ marginTop: '2px' }}>
            {thread.lastMessage.senderType === 'ADMIN' ? '↩ ' : ''}{truncate(thread.lastMessage.body)}
          </div>
        )}
        <div className="signal-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
          {formatDate(thread.updatedAt, locale)}
          {' · '}
          {thread._count.messages}{' '}{locale === 'ru' ? 'сообщ.' : 'msg'}
          {thread.assignedAdmin && (
            <> · {locale === 'ru' ? 'Назначен: ' : 'Assigned: '}{thread.assignedAdmin.name || thread.assignedAdmin.email}</>
          )}
        </div>
      </div>
      <ToolbarRow>
        <SupportStatusBadge status={thread.status} locale={locale} />
        <span className="signal-chip-link">{locale === 'ru' ? 'Открыть' : 'Open'}</span>
      </ToolbarRow>
    </Link>
  );
}
