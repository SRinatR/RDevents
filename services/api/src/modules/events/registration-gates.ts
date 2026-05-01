export type RegistrationGateEvent = {
  status: string;
  registrationEnabled: boolean;
  registrationOpensAt: Date | null;
  registrationDeadline: Date | null;
};

export function assertRegistrationGateOpen(event: RegistrationGateEvent, now = new Date()) {
  if (event.status !== 'PUBLISHED') {
    throw new Error('EVENT_NOT_AVAILABLE');
  }

  if (!event.registrationEnabled) {
    throw new Error('REGISTRATION_DISABLED');
  }

  if (event.registrationOpensAt && event.registrationOpensAt > now) {
    throw new Error('REGISTRATION_NOT_OPEN');
  }

  if (event.registrationDeadline && event.registrationDeadline < now) {
    throw new Error('REGISTRATION_DEADLINE_PASSED');
  }
}

export function isRegistrationDeadlinePassed(
  registrationDeadline: Date | string | null | undefined,
  now = new Date(),
) {
  if (!registrationDeadline) return false;
  const deadline =
    registrationDeadline instanceof Date
      ? registrationDeadline
      : new Date(registrationDeadline);

  return deadline.getTime() < now.getTime();
}