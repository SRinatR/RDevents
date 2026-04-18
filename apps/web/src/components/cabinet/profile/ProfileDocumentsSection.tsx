'use client';

import { useRef, useState } from 'react';
import { EmptyState, Notice } from '@/components/ui/signal-primitives';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import type { ProfileDocument, ProfileSectionStatus } from './profile.types';

type ProfileDocumentsSectionProps = {
  locale: string;
  status: ProfileSectionStatus;
  saving: boolean;
  documents: ProfileDocument[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (assetId: string) => Promise<void>;
};

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function ProfileDocumentsSection({
  locale,
  status,
  saving,
  documents,
  onUpload,
  onDelete,
}: ProfileDocumentsSectionProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState('');

  async function handleFile(file?: File) {
    if (!file) return;
    setLocalError('');
    if (file.size > MAX_DOCUMENT_BYTES) {
      setLocalError(locale === 'ru' ? 'Документ должен быть до 10 MB.' : 'Document must be up to 10 MB.');
      return;
    }
    await onUpload(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <ProfileSectionLayout
      locale={locale}
      title={locale === 'ru' ? 'Документы' : 'Documents'}
      description={locale === 'ru' ? 'Файлы для участия и проверки' : 'Files for participation and checks'}
      status={status}
    >
      <div className="signal-stack">
        <div
          className="profile-document-upload"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleFile(event.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,.doc,.docx"
            hidden
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <div>
            <strong>{locale === 'ru' ? 'Загрузите документ' : 'Upload a document'}</strong>
            <span>
              {locale === 'ru'
                ? 'PDF, Word или изображение до 10 MB.'
                : 'PDF, Word, or image up to 10 MB.'}
            </span>
          </div>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => inputRef.current?.click()}>
            {saving ? (locale === 'ru' ? 'Загрузка...' : 'Uploading...') : (locale === 'ru' ? 'Выбрать файл' : 'Choose file')}
          </button>
        </div>

        {localError ? <Notice tone="danger">{localError}</Notice> : null}

        {documents.length > 0 ? (
          <div className="profile-document-list">
            {documents.map((document) => (
              <div key={document.id} className="profile-document-row">
                <div>
                  <strong>{document.originalFilename}</strong>
                  <span>{formatBytes(document.sizeBytes)} · {formatDate(document.createdAt, locale)}</span>
                </div>
                <div className="profile-document-actions">
                  
                  <a className="btn btn-secondary btn-sm" href={document.publicUrl} target="_blank" rel="noreferrer">
                    {locale === 'ru' ? 'Открыть' : 'Open'}
                  </a>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => void onDelete(document.id)}>
                    {locale === 'ru' ? 'Удалить' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title={locale === 'ru' ? 'Документов пока нет' : 'No documents yet'}
            description={locale === 'ru' ? 'Загрузите файл, когда он потребуется для участия.' : 'Upload a file when participation requires it.'}
          />
        )}
      </div>
    </ProfileSectionLayout>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US');
}
