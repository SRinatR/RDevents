'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { Notice, Panel } from '@/components/ui/signal-primitives';

const API_BASE_URL =
  process.env['NEXT_PUBLIC_API_BASE_URL'] ??
  (process.env['NODE_ENV'] === 'development' ? 'http://localhost:4000' : 'https://api.rdevents.uz');

function UnsubscribePageContent() {
  const locale = useRouteLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const submit = async () => {
    setStatus('loading');

    try {
      const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/email/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) throw new Error('unsubscribe_failed');

      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="signal-page-shell">
      <Panel variant="elevated" className="admin-command-panel">
        <h1>{locale === 'ru' ? 'Отписка от рассылок' : 'Unsubscribe'}</h1>

        {!token ? (
          <Notice tone="danger">
            {locale === 'ru'
              ? 'Ссылка отписки некорректна: отсутствует token.'
              : 'Invalid unsubscribe link: token is missing.'}
          </Notice>
        ) : null}

        {status === 'success' ? (
          <Notice tone="success">
            {locale === 'ru'
              ? 'Вы успешно отписались от email-рассылок.'
              : 'You have successfully unsubscribed from email broadcasts.'}
          </Notice>
        ) : null}

        {status === 'error' ? (
          <Notice tone="danger">
            {locale === 'ru'
              ? 'Не удалось выполнить отписку. Ссылка устарела или повреждена.'
              : 'Could not unsubscribe. The link is expired or invalid.'}
          </Notice>
        ) : null}

        {status !== 'success' ? (
          <button
            className="btn btn-primary"
            disabled={!token || status === 'loading'}
            onClick={() => void submit()}
          >
            {status === 'loading'
              ? '...'
              : locale === 'ru'
                ? 'Отписаться'
                : 'Unsubscribe'}
          </button>
        ) : null}
      </Panel>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="signal-page-shell">
          <Panel variant="elevated" className="admin-command-panel">
            <h1>Unsubscribe</h1>
          </Panel>
        </div>
      }
    >
      <UnsubscribePageContent />
    </Suspense>
  );
}
