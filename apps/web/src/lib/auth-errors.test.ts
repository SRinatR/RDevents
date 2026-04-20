import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { getLoginErrorMessage } from './auth-errors';

describe('getLoginErrorMessage', () => {
  it('maps invalid credentials', () => {
    const message = getLoginErrorMessage(new ApiError(401, 'Incorrect email or password', undefined, 'WRONG_CREDENTIALS'), 'ru');

    expect(message).toContain('Неверный email');
  });

  it('maps unverified accounts', () => {
    const message = getLoginErrorMessage(new ApiError(403, 'Account is not verified', undefined, 'ACCOUNT_UNVERIFIED'), 'ru');

    expect(message).toContain('не подтверждён');
  });

  it('maps blocked accounts', () => {
    const message = getLoginErrorMessage(new ApiError(403, 'Account is disabled', undefined, 'ACCOUNT_DISABLED'), 'ru');

    expect(message).toContain('заблокирован');
  });

  it('maps server errors without exposing generic backend text', () => {
    const message = getLoginErrorMessage(new ApiError(500, 'An unexpected error occurred', undefined, 'INTERNAL_ERROR'), 'en');

    expect(message).toBe('Server error during sign-in. Please try again later.');
  });

  it('maps network errors', () => {
    const message = getLoginErrorMessage(new TypeError('Failed to fetch'), 'en');

    expect(message).toBe('Could not connect to the server. Check your connection and try again.');
  });

  it('maps post-login session failures', () => {
    const message = getLoginErrorMessage(new ApiError(401, 'SESSION_VERIFICATION_FAILED', undefined, 'SESSION_VERIFICATION_FAILED'), 'ru');

    expect(message).toContain('сессию не удалось подтвердить');
  });
});
