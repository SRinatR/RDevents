'use client';

import type { SupportChatMessage } from './support-chat.types';

function formatMsgTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function SupportChatMessageBubble({
  message,
  locale,
  isOwn,
  ownLabel,
  otherLabel,
  compact = false,
}: {
  message: SupportChatMessage;
  locale: string;
  isOwn: boolean;
  ownLabel: string;
  otherLabel: string;
  compact?: boolean;
}) {
  return (
    <div className={`support-chat-message-row ${isOwn ? 'is-own' : 'is-other'} ${compact ? 'is-compact' : ''}`}>
      <article className="support-chat-message-bubble">
        <div className="support-chat-message-bubble__meta">{isOwn ? ownLabel : otherLabel}</div>
        <p className="support-chat-message-bubble__body">{message.body}</p>
        <div className="support-chat-message-bubble__time">{formatMsgTime(message.createdAt, locale)}</div>
      </article>
    </div>
  );
}
