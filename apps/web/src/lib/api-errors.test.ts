import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { getFriendlyApiErrorMessage } from './api-errors';

describe('getFriendlyApiErrorMessage media errors', () => {
  it.each([
    ['EVENT_MEDIA_BANK_DISABLED', 'Фотобанк для этого мероприятия сейчас выключен.'],
    ['EVENT_MEDIA_UPLOAD_DISABLED', 'Загрузка материалов участниками сейчас выключена.'],
    ['EVENT_MEDIA_ALLOWED_TYPES_REQUIRED', 'Нужно оставить хотя бы один тип медиа: фото или видео.'],
    ['EVENT_MEDIA_FILE_TOO_LARGE', 'Файл слишком большой для загрузки.'],
    ['EVENT_MEDIA_FILE_TYPE_NOT_ALLOWED', 'Этот тип файла не поддерживается. Загрузите изображение или видео.'],
  ])('returns a Russian media message for %s', (code, expected) => {
    const message = getFriendlyApiErrorMessage(new ApiError(400, 'Internal error', undefined, code), 'ru');

    expect(message).toBe(expected);
    expect(message).not.toBe('Internal error');
    expect(message).not.toBe(code);
  });

  it.each([
    ['EVENT_MEDIA_BANK_DISABLED', 'Media bank is disabled for this event.'],
    ['EVENT_MEDIA_UPLOAD_DISABLED', 'Participant media upload is disabled for this event.'],
    ['EVENT_MEDIA_ALLOWED_TYPES_REQUIRED', 'At least one media type must stay enabled: photos or videos.'],
    ['EVENT_MEDIA_FILE_TOO_LARGE', 'The file is too large to upload.'],
    ['EVENT_MEDIA_FILE_TYPE_NOT_ALLOWED', 'This file type is not supported. Upload an image or video.'],
  ])('returns an English media message for %s', (code, expected) => {
    const message = getFriendlyApiErrorMessage(new ApiError(400, 'Внутренняя ошибка', undefined, code), 'en');

    expect(message).toBe(expected);
    expect(message).not.toBe('Внутренняя ошибка');
    expect(message).not.toBe(code);
  });
});
