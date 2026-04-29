export type RegistrationStatusInput = {
  registrationEnabled?: boolean | null;
  registrationOpensAt?: string | null;
  registrationDeadline?: string | null;
  registrationsCount?: number | null;
  capacity?: number | null;
  participantLimitMode?: string | null;
};

export type RegistrationClosedReason =
  | 'DISABLED'
  | 'NOT_OPEN'
  | 'DEADLINE_PASSED'
  | 'FULL'
  | null;

export function getRegistrationClosedReason(event: RegistrationStatusInput): RegistrationClosedReason {
  const now = Date.now();

  if (event.registrationEnabled === false) {
    return 'DISABLED';
  }

  if (event.registrationOpensAt && new Date(event.registrationOpensAt).getTime() > now) {
    return 'NOT_OPEN';
  }

  if (event.registrationDeadline && new Date(event.registrationDeadline).getTime() < now) {
    return 'DEADLINE_PASSED';
  }

  const isStrictLimit = event.participantLimitMode === 'STRICT_LIMIT';
  const registrationsCount = event.registrationsCount ?? 0;
  const capacity = event.capacity ?? 0;

  if (isStrictLimit && capacity > 0 && registrationsCount >= capacity) {
    return 'FULL';
  }

  return null;
}

export function isRegistrationClosed(event: RegistrationStatusInput) {
  return getRegistrationClosedReason(event) !== null;
}

export function getRegistrationClosedMessage(reason: RegistrationClosedReason, locale: string) {
  const isRu = locale === 'ru';

  switch (reason) {
    case 'DISABLED':
      return isRu
        ? 'Регистрация закрыта организатором.'
        : 'Registration is closed by the organizer.';

    case 'NOT_OPEN':
      return isRu
        ? 'Регистрация ещё не открыта.'
        : 'Registration is not open yet.';

    case 'DEADLINE_PASSED':
      return isRu
        ? 'Дедлайн регистрации прошёл. Новые заявки больше не принимаются.'
        : 'Registration deadline has passed. New applications are no longer accepted.';

    case 'FULL':
      return isRu
        ? 'Свободных мест больше нет.'
        : 'No spots left.';

    default:
      return '';
  }
}