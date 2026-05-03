import { ApiError } from './api';

export function getFriendlyApiErrorMessage(err: unknown, locale: string) {
  const isRu = locale === 'ru';

  if (err instanceof ApiError) {
    switch (err.code) {
      case 'REGISTRATION_DEADLINE_PASSED':
        return isRu
          ? 'Дедлайн регистрации прошёл. Новые заявки больше не принимаются.'
          : 'Registration deadline has passed. New applications are no longer accepted.';

      case 'REGISTRATION_DISABLED':
        return isRu
          ? 'Регистрация закрыта организатором.'
          : 'Registration is closed by the organizer.';

      case 'REGISTRATION_NOT_OPEN':
        return isRu
          ? 'Регистрация ещё не открыта.'
          : 'Registration is not open yet.';

      case 'EVENT_FULL':
      case 'CAPACITY_REACHED':
        return isRu
          ? 'Свободных мест больше нет.'
          : 'No spots left.';

      case 'EVENT_MEDIA_BANK_DISABLED':
        return isRu
          ? 'Фотобанк для этого мероприятия сейчас выключен.'
          : 'Media bank is disabled for this event.';

      case 'EVENT_MEDIA_UPLOAD_DISABLED':
        return isRu
          ? 'Загрузка материалов участниками сейчас выключена.'
          : 'Participant media upload is disabled for this event.';

      case 'EVENT_MEDIA_UPLOAD_FORBIDDEN':
        return isRu
          ? 'Загрузка доступна только подтверждённым участникам мероприятия.'
          : 'Only approved event participants can upload media.';

      case 'EVENT_MEDIA_FILE_REQUIRED':
        return isRu
          ? 'Выберите фото или видео для загрузки.'
          : 'Choose a photo or video to upload.';

      case 'EVENT_MEDIA_FILE_TYPE_NOT_ALLOWED':
        return isRu
          ? 'Этот тип файла не поддерживается. Загрузите изображение или видео.'
          : 'This file type is not supported. Upload an image or video.';

      case 'EVENT_MEDIA_FILE_TOO_LARGE':
        return isRu
          ? 'Файл слишком большой для загрузки.'
          : 'The file is too large to upload.';

      case 'EVENT_MEDIA_REJECTION_REASON_REQUIRED':
        return isRu
          ? 'Укажите причину отклонения материала.'
          : 'Please provide a rejection reason.';

      case 'EVENT_MEDIA_ALLOWED_TYPES_REQUIRED':
        return isRu
          ? 'Нужно оставить хотя бы один тип медиа: фото или видео.'
          : 'At least one media type must stay enabled: photos or videos.';

      case 'EVENT_MEDIA_NOT_FOUND':
        return isRu
          ? 'Материал не найден.'
          : 'Media item not found.';

      default:
        return err.message;
    }
  }

  return isRu ? 'Действие не удалось.' : 'Action failed.';
}
