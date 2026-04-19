'use client';

import { useState, useRef } from 'react';
import { supportApi } from '@/lib/api';
import { FieldInput, FieldTextarea, Notice } from '@/components/ui/signal-primitives';

const MAX_FILES = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

interface Props {
  locale: string;
  onCreated: (thread: unknown) => void;
  onCancel: () => void;
}

export function NewThreadForm({ locale, onCreated, onCancel }: Props) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = (body.trim().length > 0 || files.length > 0) && !loading;

  function addFiles(incoming: File[]) {
    const invalid = incoming.filter((f) => !ALLOWED_TYPES.includes(f.type));
    if (invalid.length) {
      setError(locale === 'ru'
        ? 'Допустимы только изображения (JPEG, PNG, WebP) и PDF.'
        : 'Only images (JPEG, PNG, WebP) and PDF are allowed.');
      return false;
    }
    setFiles((prev) => [...prev, ...incoming].slice(0, MAX_FILES));
    return true;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageItems = Array.from(e.clipboardData.items).filter(
      (item) => item.kind === 'file' && ALLOWED_TYPES.includes(item.type),
    );
    if (imageItems.length === 0) return;
    const pastedFiles = imageItems.map((item) => item.getAsFile()).filter((f): f is File => f !== null);
    if (pastedFiles.length === 0) return;
    if (files.length >= MAX_FILES) {
      setError(locale === 'ru' ? `Максимум ${MAX_FILES} файлов.` : `Maximum ${MAX_FILES} files allowed.`);
      return;
    }
    addFiles(pastedFiles);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setLoading(true);
    setError('');
    try {
      const fallback = locale === 'ru' ? 'Обращение в поддержку' : 'Support request';
      const { thread } = await supportApi.createThread({
        subject: subject.trim() || fallback,
      });

      try {
        let attachmentIds: string[] = [];
        if (files.length > 0) {
          const uploaded = await supportApi.uploadAttachments(thread.id, files);
          attachmentIds = (uploaded.attachments as Array<{ id: string }>).map((a) => a.id);
        }
        await supportApi.sendMessage(thread.id, { body: body.trim(), attachmentIds });
      } catch (postCreateErr) {
        // Thread exists but has no messages — clean it up before surfacing the error
        await supportApi.deleteEmptyThread(thread.id).catch(() => {});
        throw postCreateErr;
      }

      onCreated(thread);
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
          {locale === 'ru' ? 'Сообщение' : 'Message'}
        </label>
        {files.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {files.map((f, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '3px 10px', borderRadius: '999px',
                background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)',
                fontSize: '0.8rem', color: 'var(--color-text-secondary)',
              }}>
                {f.name}
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1, padding: 0, fontSize: '1rem' }}
                  aria-label={locale === 'ru' ? 'Удалить' : 'Remove'}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <FieldTextarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={handlePaste}
          rows={4}
          placeholder={locale === 'ru' ? 'Опишите ваш вопрос подробнее…' : 'Describe your issue in detail…'}
          disabled={loading}
        />
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || files.length >= MAX_FILES}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <PaperclipIcon />
            {locale === 'ru' ? 'Прикрепить' : 'Attach'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {files.length > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {files.length}/{MAX_FILES}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={onCancel} className="btn btn-secondary btn-sm" disabled={loading}>
            {locale === 'ru' ? 'Отмена' : 'Cancel'}
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!canSend}>
            {loading
              ? (locale === 'ru' ? 'Создание…' : 'Creating…')
              : (locale === 'ru' ? 'Создать обращение' : 'Create ticket')}
          </button>
        </div>
      </div>
    </form>
  );
}

function PaperclipIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
