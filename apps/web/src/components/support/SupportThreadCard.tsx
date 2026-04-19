'use client';

import Link from 'next/link';
import { ToolbarRow } from '@/components/ui/signal-primitives';
import { SupportStatusBadge } from './SupportStatusBadge';
import type { SupportThread } from './support.types';

function truncate(text: string, max = 90) {
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
      background: 'var(--color-primary)',
      flexShrink: 0,
    }} aria-label="unread" />
  );
}

export function SupportThreadCard({ thread, locale }: { thread: SupportThread; locale: string }) {
  return (
    <Link
      href={`/${locale}/cabinet/support/${thread.id}`}
      className="signal-ranked-item cabinet-list-item workspace-event-journey-item"
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <strong>{thread.subject}</strong>
          {thread.hasUnread && <UnreadDot />}
        </div>
        {thread.lastMessage && (
          <div className="signal-muted" style={{ marginTop: '2px' }}>
            {thread.lastMessage.senderType === 'ADMIN' ? `↩ ` : ''}{truncate(thread.lastMessage.body)}
          </div>
        )}
        <div className="signal-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
          {formatDate(thread.updatedAt, locale)}
          {' · '}
          {thread._count.messages}{' '}{locale === 'ru' ? 'сообщ.' : 'msg'}
        </div>
      </div>
      <ToolbarRow>
        <SupportStatusBadge status={thread.status} locale={locale} />
        <span className="signal-chip-link">{locale === 'ru' ? 'Открыть' : 'Open'}</span>
      </ToolbarRow>
    </Link>
  );
}
