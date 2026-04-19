'use client';

import type { SupportMessage } from './support.types';
import { SupportAttachmentList } from './SupportAttachmentList';

function formatMsgTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function SupportMessageBubble({
  message,
  currentUserId,
  locale,
}: {
  message: SupportMessage;
  currentUserId: string;
  locale: string;
}) {
  const isOwn = message.senderType === 'USER' && message.senderId === currentUserId;
  const isAdmin = message.senderType === 'ADMIN';

  return (
    <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
      <div style={{
        maxWidth: '72%',
        padding: '10px 14px',
        borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isOwn ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
        border: `1px solid ${isOwn ? 'var(--color-primary-glow)' : 'var(--color-border-soft)'}`,
        boxShadow: isOwn ? 'none' : 'var(--shadow-xs)',
      }}>
        {isAdmin && (
          <div style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {locale === 'ru' ? 'Поддержка' : 'Support'}
          </div>
        )}
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.body}
        </p>
        {message.attachments.length > 0 && (
          <SupportAttachmentList attachments={message.attachments} />
        )}
        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', marginTop: '6px', textAlign: isOwn ? 'right' : 'left' }}>
          {formatMsgTime(message.createdAt, locale)}
        </div>
      </div>
    </div>
  );
}
