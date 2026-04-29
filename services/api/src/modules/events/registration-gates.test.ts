import { describe, expect, it } from 'vitest';
import {
  assertRegistrationGateOpen,
  isRegistrationDeadlinePassed,
  type RegistrationGateEvent,
} from './registration-gates.js';

const pastDate = new Date('2020-01-01T00:00:00.000Z');
const futureDate = new Date('2099-01-01T00:00:00.000Z');
const now = new Date();

function makeEvent(overrides: Partial<RegistrationGateEvent> = {}): RegistrationGateEvent {
  return {
    status: 'PUBLISHED',
    registrationEnabled: true,
    registrationOpensAt: null,
    registrationDeadline: null,
    ...overrides,
  };
}

describe('assertRegistrationGateOpen', () => {
  it('throws EVENT_NOT_AVAILABLE when status is not PUBLISHED', () => {
    expect(() => assertRegistrationGateOpen(makeEvent({ status: 'DRAFT' }))).toThrow('EVENT_NOT_AVAILABLE');
    expect(() => assertRegistrationGateOpen(makeEvent({ status: 'CANCELLED' }))).toThrow('EVENT_NOT_AVAILABLE');
  });

  it('throws REGISTRATION_DISABLED when registrationEnabled is false', () => {
    expect(() => assertRegistrationGateOpen(makeEvent({ registrationEnabled: false }))).toThrow('REGISTRATION_DISABLED');
  });

  it('throws REGISTRATION_NOT_OPEN when registrationOpensAt is in the future', () => {
    expect(() => assertRegistrationGateOpen(makeEvent({ registrationOpensAt: futureDate }))).toThrow('REGISTRATION_NOT_OPEN');
  });

  it('does not throw when registrationOpensAt is in the past', () => {
    expect(() => assertRegistrationGateOpen(makeEvent({ registrationOpensAt: pastDate }))).not.toThrow();
  });

  it('throws REGISTRATION_DEADLINE_PASSED when registrationDeadline is in the past', () => {
    expect(() => assertRegistrationGateOpen(makeEvent({ registrationDeadline: pastDate }))).toThrow('REGISTRATION_DEADLINE_PASSED');
  });

  it('does not throw when registrationDeadline is in the future', () => {
    expect(() => assertRegistrationGateOpen(makeEvent({ registrationDeadline: futureDate }))).not.toThrow();
  });

  it('allows null registrationOpensAt', () => {
    expect(() => assertRegistrationGateOpen(makeEvent({ registrationOpensAt: null }))).not.toThrow();
  });

  it('allows null registrationDeadline', () => {
    expect(() => assertRegistrationGateOpen(makeEvent({ registrationDeadline: null }))).not.toThrow();
  });

  it('respects custom now parameter', () => {
    const deadline = new Date('2025-01-01T00:00:00.000Z');
    expect(() => assertRegistrationGateOpen(makeEvent({ registrationDeadline: deadline }), new Date('2024-01-01'))).not.toThrow();
    expect(() => assertRegistrationGateOpen(makeEvent({ registrationDeadline: deadline }), new Date('2026-01-01'))).toThrow('REGISTRATION_DEADLINE_PASSED');
  });

  it('checks all gates in correct order: status first', () => {
    const event = makeEvent({ status: 'DRAFT', registrationEnabled: false, registrationOpensAt: futureDate, registrationDeadline: pastDate });
    expect(() => assertRegistrationGateOpen(event)).toThrow('EVENT_NOT_AVAILABLE');
  });

  it('checks all gates in correct order: registrationEnabled after status', () => {
    const event = makeEvent({ status: 'PUBLISHED', registrationEnabled: false, registrationOpensAt: futureDate, registrationDeadline: pastDate });
    expect(() => assertRegistrationGateOpen(event)).toThrow('REGISTRATION_DISABLED');
  });

  it('checks all gates in correct order: registrationOpensAt after registrationEnabled', () => {
    const event = makeEvent({ status: 'PUBLISHED', registrationEnabled: true, registrationOpensAt: futureDate, registrationDeadline: pastDate });
    expect(() => assertRegistrationGateOpen(event)).toThrow('REGISTRATION_NOT_OPEN');
  });

  it('checks all gates in correct order: registrationDeadline last', () => {
    const event = makeEvent({ status: 'PUBLISHED', registrationEnabled: true, registrationOpensAt: null, registrationDeadline: pastDate });
    expect(() => assertRegistrationGateOpen(event)).toThrow('REGISTRATION_DEADLINE_PASSED');
  });
});

describe('isRegistrationDeadlinePassed', () => {
  it('returns true when deadline is in the past', () => {
    expect(isRegistrationDeadlinePassed(pastDate)).toBe(true);
  });

  it('returns false when deadline is in the future', () => {
    expect(isRegistrationDeadlinePassed(futureDate)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isRegistrationDeadlinePassed(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isRegistrationDeadlinePassed(undefined)).toBe(false);
  });

  it('accepts ISO string date', () => {
    expect(isRegistrationDeadlinePassed('2020-01-01T00:00:00.000Z')).toBe(true);
    expect(isRegistrationDeadlinePassed('2099-01-01T00:00:00.000Z')).toBe(false);
  });

  it('respects custom now parameter', () => {
    expect(isRegistrationDeadlinePassed(new Date('2025-01-01'), new Date('2024-01-01'))).toBe(false);
    expect(isRegistrationDeadlinePassed(new Date('2025-01-01'), new Date('2026-01-01'))).toBe(true);
  });

  it('returns false when deadline equals now', () => {
    const exactNow = new Date(now.getTime());
    expect(isRegistrationDeadlinePassed(exactNow, exactNow)).toBe(false);
  });
});