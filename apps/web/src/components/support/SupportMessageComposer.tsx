'use client';

import { useState, useRef } from 'react';
import { supportApi } from '@/lib/api';
import { FieldTextarea, Notice } from '@/components/ui/signal-primitives';

const MAX_FILES = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

interface Props {
  threadId: string;
  disabled?: boolean;
  locale: string;
  onSent: (message: unknown) => void;
}

export function SupportMessageComposer({ threadId, disabled, locale, onSent }: Props) {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Send is allowed when there is text OR at least one attachment
  const canSend = (body.trim().length > 0 || files.length > 0) && !sending && !disabled;

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

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError('');
    try {
      let attachmentIds: string[] = [];
      if (files.length > 0) {
        const uploaded = await supportApi.uploadAttachments(threadId, files);
        attachmentIds = (uploaded.attachments as Array<{ id: string }>).map((a) => a.id);
      }
      const result = await supportApi.sendMessage(threadId, { body: body.trim(), attachmentIds });
      setBody('');
      setFiles([]);
      onSent(result.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg || (locale === 'ru' ? 'Не удалось отправить сообщение.' : 'Failed to send message.'));
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  if (disabled) {
    return (
      <Notice tone="info">
        {locale === 'ru'
          ? 'Обращение закрыто. Отправка сообщений недоступна.'
          : 'This ticket is closed. No new messages can be sent.'}
      </Notice>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {error && <Notice tone="danger">{error}</Notice>}

      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        rows={3}
        placeholder={locale === 'ru'
          ? 'Введите сообщение… (Ctrl+Enter для отправки)'
          : 'Type a message… (Ctrl+Enter to send)'}
        disabled={sending}
      />

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || files.length >= MAX_FILES}
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
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="btn btn-primary btn-sm"
        >
          {sending
            ? (locale === 'ru' ? 'Отправка…' : 'Sending…')
            : (locale === 'ru' ? 'Отправить' : 'Send')}
        </button>
      </div>
    </div>
  );
}

function PaperclipIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
