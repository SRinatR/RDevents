'use client';

import { useState } from 'react';
import { FieldTextarea, Notice, Panel, SectionHeader, ToolbarRow } from '@/components/ui/signal-primitives';

type EventGalleryUploadPanelProps = {
  locale: string;
  title: string;
  subtitle: string;
  helper: string;
  buttonLabel: string;
  uploadingLabel: string;
  successMessage: string;
  onUpload: (file: File, caption: string) => Promise<void>;
};

export function EventGalleryUploadPanel({
  locale,
  title,
  subtitle,
  helper,
  buttonLabel,
  uploadingLabel,
  successMessage,
  onUpload,
}: EventGalleryUploadPanelProps) {
  const isRu = locale === 'ru';
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inputKey, setInputKey] = useState(0);

  async function handleSubmit() {
    if (!file) return;
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await onUpload(file, caption);
      setFile(null);
      setCaption('');
      setInputKey((value) => value + 1);
      setSuccess(successMessage);
    } catch (err: any) {
      setError(err?.message || (isRu ? 'Не удалось загрузить файл' : 'Failed to upload file'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel variant="elevated" className="event-gallery-upload-panel">
      <SectionHeader title={title} subtitle={subtitle} />

      <div className="event-gallery-upload-form">
        <label className="event-gallery-file-picker">
          <span>{isRu ? 'Выберите файл' : 'Choose file'}</span>
          <input
            key={inputKey}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <FieldTextarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder={isRu ? 'Подпись или краткое описание (необязательно)' : 'Caption or short description (optional)'}
          rows={3}
        />

        <div className="event-gallery-file-meta">
          <strong>{file?.name ?? (isRu ? 'Файл пока не выбран' : 'No file selected yet')}</strong>
          <span>{helper}</span>
        </div>

        <ToolbarRow>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!file || submitting}
            onClick={handleSubmit}
          >
            {submitting ? uploadingLabel : buttonLabel}
          </button>
        </ToolbarRow>
      </div>

      {success ? <Notice tone="success">{success}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Panel>
  );
}
