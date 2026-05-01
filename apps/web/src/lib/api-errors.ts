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

      default:
        return err.message;
    }
  }

  return isRu ? 'Действие не удалось.' : 'Action failed.';
}