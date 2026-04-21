'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { supportChatApi } from '@/lib/api';
import type { SupportChatMessage, SupportChatThread } from '@/components/support-chat/support-chat.types';
import { SupportChatMessageBubble } from '@/components/support-chat/SupportChatMessageBubble';
import { SupportChatComposer } from '@/components/support-chat/SupportChatComposer';

type FloatingSupportLauncherProps = {
  locale: string;
};

const POLL_INTERVAL_MS = 8000;

export function FloatingSupportLauncher({ locale }: FloatingSupportLauncherProps) {
  const { user } = useAuth();
  const isRu = locale === 'ru';

  const [isOpen, setIsOpen] = useState(false);
  const [thread, setThread] = useState<SupportChatThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const messagesRef = useRef<HTMLDivElement>(null);

  const chatPath = `/${locale}/cabinet/support-chat`;
  const loginPath = `/${locale}/login?next=${encodeURIComponent(chatPath)}`;
  const launcherLabel = isRu ? 'Чат поддержки' : 'Support chat';

  async function loadThread(silent = false) {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const result = await supportChatApi.getThread();
      setThread(result.thread as SupportChatThread);
      setError('');
    } catch {
      if (!silent) setError(isRu ? 'Не удалось загрузить чат поддержки.' : 'Failed to load support chat.');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOpen || !user) return;
    void loadThread(false);
    const timer = setInterval(() => void loadThread(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isOpen, user]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.messages.length, isOpen]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending || !user) return;
    setSending(true);
    try {
      const result = await supportChatApi.sendMessage({ body });
      const message = result.message as SupportChatMessage;
      setThread((prev) => (prev ? { ...prev, messages: [...prev.messages, message] } : prev));
      setDraft('');
    } catch {
      setError(isRu ? 'Не удалось отправить сообщение.' : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {isOpen ? (
        <div id="floating-support-panel" className="floating-support-panel" role="dialog" aria-label={isRu ? 'Чат поддержки' : 'Support chat'}>
          <div className="floating-support-panel__header">
            <div>
              <strong>{isRu ? 'Чат поддержки' : 'Support Chat'}</strong>
              <div className="floating-support-panel__subtitle">
                {isRu ? 'Одна постоянная переписка с командой поддержки' : 'One persistent conversation with the support team'}
              </div>
            </div>
            <div className="floating-support-panel__actions">
              {user ? <Link href={chatPath} className="btn btn-secondary btn-sm">{isRu ? 'Открыть страницу' : 'Open page'}</Link> : null}
              <button type="button" className="floating-support-panel__close" onClick={() => setIsOpen(false)} aria-label={isRu ? 'Закрыть' : 'Close'}>×</button>
            </div>
          </div>

          <div className="floating-support-panel__content">
            {!user ? (
              <div className="floating-support-panel__empty">
                <p>{isRu ? 'Чтобы писать в чат поддержки, войдите в аккаунт.' : 'Sign in to use support chat.'}</p>
                <Link className="btn btn-primary btn-sm" href={loginPath}>{isRu ? 'Войти' : 'Sign in'}</Link>
              </div>
            ) : loading ? (
              <div className="floating-support-panel__empty">{isRu ? 'Загрузка…' : 'Loading…'}</div>
            ) : error ? (
              <div className="floating-support-panel__error">{error}</div>
            ) : !thread ? null : (
              <>
                <div className="floating-support-panel__messages" ref={messagesRef}>
                  {thread.messages.length === 0 ? (
                    <div className="floating-support-panel__empty">
                      {isRu ? 'Напишите первое сообщение в поддержку.' : 'Send your first message to support.'}
                    </div>
                  ) : (
                    thread.messages.map((message) => (
                      <SupportChatMessageBubble
                        key={message.id}
                        message={message}
                        locale={locale}
                        isOwn={message.senderId === user.id}
                        ownLabel={isRu ? 'Вы' : 'You'}
                        otherLabel={isRu ? 'Поддержка' : 'Support'}
                        compact
                      />
                    ))
                  )}
                </div>
                <div className="floating-support-panel__composer">
                  <SupportChatComposer
                    value={draft}
                    onChange={setDraft}
                    onSend={() => void handleSend()}
                    sending={sending}
                    placeholder={isRu ? 'Введите сообщение…' : 'Type a message…'}
                    sendLabel={isRu ? 'Отправить' : 'Send'}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="floating-support-launcher"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls="floating-support-panel"
        title={launcherLabel}
      >
        <span>{launcherLabel}</span>
      </button>
    </>
  );
}
