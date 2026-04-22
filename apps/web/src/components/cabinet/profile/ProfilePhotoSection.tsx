'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Notice } from '@/components/ui/signal-primitives';
import type { AuthUser } from '@/hooks/useAuth';
import { ProfileSectionLayout } from './ProfileSectionLayout';
import type { ProfileSectionStatus } from './profile.types';

type ProfilePhotoSectionProps = {
  locale: string;
  user: AuthUser;
  status: ProfileSectionStatus;
  saving: boolean;
  requiredFields: string[];
  eventTitle?: string;
  onUpload: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
};

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

export function ProfilePhotoSection({
  locale,
  user,
  status,
  saving,
  requiredFields,
  eventTitle,
  onUpload,
  onDelete,
}: ProfilePhotoSectionProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const isRequired = requiredFields.includes('avatarUrl') || requiredFields.includes('photo');
  const displayUrl = previewUrl || user.avatarUrl || '';
  const initials = (user.name || user.fullNameCyrillic || user.email || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(file?: File) {
    if (!file) return;
    setLocalError('');

    if (!ACCEPTED_TYPES.has(file.type)) {
      setLocalError(locale === 'ru' ? 'Загрузите JPG, PNG или WebP.' : 'Upload JPG, PNG, or WebP.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setLocalError(locale === 'ru' ? 'Фото должно быть до 3 MB.' : 'Photo must be up to 3 MB.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return objectUrl;
    });
    await onUpload(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <ProfileSectionLayout
      locale={locale}
      title={locale === 'ru' ? 'Фото профиля' : 'Profile photo'}
      description={locale === 'ru' ? 'Фото будет видно в кабинете и заявках' : 'The photo is used in the cabinet and applications'}
      status={status}
    >
      <div className="profile-photo-grid">
        <div
          className="profile-upload-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleFile(event.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <div className="profile-photo-preview">
            {displayUrl ? <Image src={displayUrl} alt="" width={120} height={120} style={{ objectFit: 'cover' }} /> : <span>{initials}</span>}
          </div>
          <div className="profile-upload-copy">
            <strong>{locale === 'ru' ? 'Загрузите новое фото' : 'Upload a new photo'}</strong>
            <span>
              {locale === 'ru'
                ? 'Перетащите файл сюда или выберите на устройстве.'
                : 'Drop a file here or choose one from your device.'}
            </span>
            {isRequired ? (
              <small className="signal-required-hint">
                {locale === 'ru'
                  ? `Обязательно${eventTitle ? ` для "${eventTitle}"` : ''}.`
                  : `Required${eventTitle ? ` for "${eventTitle}"` : ''}.`}
              </small>
            ) : null}
          </div>
          <div className="profile-photo-actions">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => inputRef.current?.click()}>
              {saving ? (locale === 'ru' ? 'Загрузка...' : 'Uploading...') : (locale === 'ru' ? 'Выбрать файл' : 'Choose file')}
            </button>
            {user.avatarUrl ? (
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => void onDelete()}>
                {locale === 'ru' ? 'Удалить' : 'Delete'}
              </button>
            ) : null}
          </div>
          {localError ? <Notice tone="danger">{localError}</Notice> : null}
        </div>

        <aside className="profile-requirements-panel">
          <h3>{locale === 'ru' ? 'Требования' : 'Requirements'}</h3>
          <ul>
            <li>{locale === 'ru' ? 'Лицо анфас' : 'Face the camera'}</li>
            <li>{locale === 'ru' ? 'Лицо крупно в кадре' : 'Face clearly visible'}</li>
            <li>{locale === 'ru' ? 'Нейтральный фон' : 'Neutral background'}</li>
            <li>{locale === 'ru' ? 'JPG, PNG или WebP' : 'JPG, PNG, or WebP'}</li>
            <li>{locale === 'ru' ? 'До 3 MB' : 'Up to 3 MB'}</li>
          </ul>
        </aside>
      </div>
    </ProfileSectionLayout>
  );
}
