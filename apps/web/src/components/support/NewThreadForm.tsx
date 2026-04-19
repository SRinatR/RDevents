'use client';

import { useState } from 'react';
import { supportApi } from '@/lib/api';
import { FieldInput, FieldTextarea, Notice } from '@/components/ui/signal-primitives';

interface Props {
  locale: string;
  onCreated: (thread: unknown) => void;
  onCancel: () => void;
}

export function NewThreadForm({ locale, onCreated, onCancel }: Props) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await supportApi.createThread({
        subject: subject.trim() || (locale === 'ru' ? 'Обращение в поддержку' : 'Support request'),
        body: body.trim(),
      });
      onCreated(result.thread);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg || (locale === 'ru' ? 'Не удалось создать обращение.' : 'Failed to create ticket.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {error && <Notice tone="danger">{error}</Notice>}
      <div>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          {locale === 'ru' ? 'Тема (необязательно)' : 'Subject (optional)'}
        </label>
        <FieldInput
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={locale === 'ru' ? 'Кратко опишите вопрос' : 'Brief description'}
          maxLength={200}
          disabled={loading}
        />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          {locale === 'ru' ? 'Сообщение' : 'Message'}{' '}
          <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <FieldTextarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder={locale === 'ru' ? 'Опишите ваш вопрос подробнее…' : 'Describe your issue in detail…'}
          required
          disabled={loading}
        />
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} className="btn btn-secondary btn-sm" disabled={loading}>
          {locale === 'ru' ? 'Отмена' : 'Cancel'}
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !body.trim()}>
          {loading
            ? (locale === 'ru' ? 'Создание…' : 'Creating…')
            : (locale === 'ru' ? 'Создать обращение' : 'Create ticket')}
        </button>
      </div>
    </form>
  );
}
