'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supportApi } from '@/lib/api';
import { NewThreadForm } from '@/components/support/NewThreadForm';
import { SupportMessageBubble } from '@/components/support/SupportMessageBubble';
import { SupportMessageComposer } from '@/components/support/SupportMessageComposer';
import { SupportStatusBadge } from '@/components/support/SupportStatusBadge';
import type { SupportMessage, SupportThread, SupportThreadDetail } from '@/components/support/support.types';

type FloatingSupportLauncherProps = {
  locale: string;
};

type ViewMode = 'list' | 'thread' | 'new';

const POLL_INTERVAL_MS = 10000;

export function FloatingSupportLauncher({ locale }: FloatingSupportLauncherProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('list');
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<SupportThreadDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState('');

  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const isRu = locale === 'ru';
  const supportPath = `/${locale}/cabinet/support`;
  const loginPath = `/${locale}/login?next=${encodeURIComponent(supportPath)}`;

  const launcherLabel = isRu ? 'Чат поддержки' : 'Support chat';
  const title = isRu ? 'Поддержка' : 'Support';

  const activeThreadSummary = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId],
  );

  const fetchThreads = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) {
      setThreadsLoading(true);
      setThreadsError('');
    }
    try {
      const result = await supportApi.listThreads();
      setThreads((result.data as SupportThread[]) ?? []);
    } catch {
      if (!silent) {
        setThreadsError(isRu ? 'Не удалось загрузить обращения.' : 'Failed to load tickets.');
      }
    } finally {
      if (!silent) setThreadsLoading(false);
    }
  }, [isRu, user]);

  const fetchThread = useCallback(async (threadId: string, silent = false) => {
    if (!user) return;
    if (!silent) {
      setThreadLoading(true);
      setThreadError('');
    }
    try {
      const result = await supportApi.getThread(threadId);
      setActiveThread(result.thread as SupportThreadDetail);
      supportApi.markRead(threadId).catch(() => {});
    } catch {
      if (!silent) {
        setThreadError(isRu ? 'Не удалось загрузить переписку.' : 'Failed to load conversation.');
      }
    } finally {
      if (!silent) setThreadLoading(false);
    }
  }, [isRu, user]);

  useEffect(() => {
    setIsOpen(false);
    setView('list');
  }, [pathname]);

  useEffect(() => {
    if (!isOpen || !user) return;
    void fetchThreads();
  }, [fetchThreads, isOpen, user]);

  useEffect(() => {
    if (!isOpen || !user) return;
    const timer = setInterval(() => {
      void fetchThreads(true);
      if (view === 'thread' && activeThreadId) {
        void fetchThread(activeThreadId, true);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [activeThreadId, fetchThread, fetchThreads, isOpen, user, view]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el || view !== 'thread') return;
    el.scrollTop = el.scrollHeight;
  }, [activeThread?.messages.length, view]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || launcherRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || window.innerWidth >= 768) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  function openThread(threadId: string) {
    setActiveThreadId(threadId);
    setView('thread');
    void fetchThread(threadId);
  }

  function handleToggle() {
    if (!isOpen) {
      setView('list');
    }
    setIsOpen((prev) => !prev);
  }

  function handleMessageSent(newMessage: unknown) {
    const message = newMessage as SupportMessage;
    setActiveThread((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...prev.messages, message],
      };
    });
    void fetchThreads(true);
  }

  function handleThreadCreated(thread: unknown) {
    const created = thread as { id: string };
    setActiveThreadId(created.id);
    setView('thread');
    void fetchThreads(true);
    void fetchThread(created.id);
  }

  return (
    <>
      {isOpen && (
        <div
          ref={panelRef}
          id="floating-support-panel"
          className="floating-support-panel"
          role="dialog"
          aria-modal="false"
          aria-label={isRu ? 'Мини-чат поддержки' : 'Support mini chat'}
        >
          <div className="floating-support-panel__header">
            <div>
              <strong>{title}</strong>
              <div className="floating-support-panel__subtitle">
                {view === 'thread'
                  ? activeThreadSummary?.subject ?? (isRu ? 'Переписка' : 'Conversation')
                  : view === 'new'
                    ? (isRu ? 'Новое обращение' : 'New ticket')
                    : (isRu ? 'Ваши обращения' : 'Your tickets')}
              </div>
            </div>
            <div className="floating-support-panel__actions">
              <Link href={supportPath} className="btn btn-secondary btn-sm">
                {isRu ? 'Полная версия' : 'Full page'}
              </Link>
              <button type="button" className="floating-support-panel__close" onClick={() => setIsOpen(false)} aria-label={isRu ? 'Закрыть' : 'Close'}>
                ×
              </button>
            </div>
          </div>

          <div className="floating-support-panel__content">
            {!loading && !user ? (
              <div className="floating-support-panel__empty">
                <p>{isRu ? 'Чтобы написать в поддержку, войдите в аккаунт.' : 'Sign in to chat with support.'}</p>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => router.push(loginPath)}>
                  {isRu ? 'Войти' : 'Sign in'}
                </button>
              </div>
            ) : view === 'new' ? (
              <NewThreadForm
                locale={locale}
                onCreated={handleThreadCreated}
                onCancel={() => setView('list')}
              />
            ) : view === 'thread' ? (
              <>
                <div className="floating-support-panel__thread-toolbar">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView('list')}>
                    {isRu ? '← К списку' : '← Back to list'}
                  </button>
                  {activeThread ? <SupportStatusBadge status={activeThread.status} locale={locale} /> : null}
                </div>
                {threadLoading ? (
                  <div className="floating-support-panel__empty">{isRu ? 'Загрузка…' : 'Loading…'}</div>
                ) : threadError ? (
                  <div className="floating-support-panel__error">{threadError}</div>
                ) : !activeThread ? null : (
                  <>
                    <div className="floating-support-panel__messages" ref={messagesRef}>
                      {activeThread.messages.length === 0 ? (
                        <div className="floating-support-panel__empty">
                          {isRu ? 'Сообщений пока нет.' : 'No messages yet.'}
                        </div>
                      ) : (
                        activeThread.messages.map((message) => (
                          <SupportMessageBubble
                            key={message.id}
                            message={message}
                            currentUserId={user!.id}
                            locale={locale}
                          />
                        ))
                      )}
                    </div>
                    <div className="floating-support-panel__composer">
                      <SupportMessageComposer
                        threadId={activeThread.id}
                        locale={locale}
                        disabled={activeThread.status === 'CLOSED'}
                        onSent={handleMessageSent}
                      />
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="floating-support-panel__list-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setView('new')}>
                    {isRu ? 'Новое обращение' : 'New ticket'}
                  </button>
                </div>
                {threadsLoading ? (
                  <div className="floating-support-panel__empty">{isRu ? 'Загрузка…' : 'Loading…'}</div>
                ) : threadsError ? (
                  <div className="floating-support-panel__error">{threadsError}</div>
                ) : threads.length === 0 ? (
                  <div className="floating-support-panel__empty">
                    {isRu ? 'У вас пока нет обращений.' : 'You have no tickets yet.'}
                  </div>
                ) : (
                  <div className="floating-support-panel__list">
                    {threads.map((thread) => (
                      <button
                        type="button"
                        key={thread.id}
                        className="floating-support-thread-item"
                        onClick={() => openThread(thread.id)}
                      >
                        <div className="floating-support-thread-item__title-row">
                          <strong>{thread.subject}</strong>
                          {thread.hasUnread ? <span className="floating-support-thread-item__dot" /> : null}
                        </div>
                        {thread.lastMessage?.body ? (
                          <div className="floating-support-thread-item__preview">{thread.lastMessage.body}</div>
                        ) : null}
                        <div className="floating-support-thread-item__meta">
                          <SupportStatusBadge status={thread.status} locale={locale} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <button
        ref={launcherRef}
        type="button"
        className="floating-support-launcher"
        aria-label={launcherLabel}
        aria-expanded={isOpen}
        aria-controls="floating-support-panel"
        onClick={handleToggle}
      >
        <ChatIcon />
        <span>{launcherLabel}</span>
      </button>
    </>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M19 4H5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h2v3.2a.8.8 0 0 0 1.31.61L13.2 18H19a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm1 11a1 1 0 0 1-1 1h-6.1a1 1 0 0 0-.63.23L9 18.88V17a1 1 0 0 0-1-1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H19a1 1 0 0 1 1 1Z" fill="currentColor" />
      <circle cx="8" cy="11" r="1.2" fill="currentColor" />
      <circle cx="12" cy="11" r="1.2" fill="currentColor" />
      <circle cx="16" cy="11" r="1.2" fill="currentColor" />
    </svg>
  );
}
