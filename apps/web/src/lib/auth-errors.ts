import { ApiError } from './api';

type Locale = 'ru' | 'en' | string;

const loginMessages = {
  ru: {
    wrongCredentials: 'Неверный email или пароль.',
    accountUnverified: 'Аккаунт не подтверждён. Завершите подтверждение email и попробуйте снова.',
    accountDisabled: 'Аккаунт заблокирован. Обратитесь в поддержку.',
    server: 'Ошибка сервера при входе. Попробуйте позже.',
    network: 'Не удалось подключиться к серверу. Проверьте интернет и попробуйте снова.',
    session: 'Вход выполнен, но сессию не удалось подтвердить. Пожалуйста, войдите ещё раз.',
    fallback: 'Не удалось войти. Проверьте данные и попробуйте снова.',
  },
  en: {
    wrongCredentials: 'Incorrect email or password.',
    accountUnverified: 'This account is not verified. Complete email verification and try again.',
    accountDisabled: 'This account is blocked. Contact support.',
    server: 'Server error during sign-in. Please try again later.',
    network: 'Could not connect to the server. Check your connection and try again.',
    session: 'Sign-in succeeded, but the session could not be verified. Please sign in again.',
    fallback: 'Could not sign in. Check your details and try again.',
  },
} as const;

function messagesFor(locale: Locale) {
  return locale === 'ru' ? loginMessages.ru : loginMessages.en;
}

function isNetworkError(error: unknown) {
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    return /failed to fetch|networkerror|load failed|network request failed/i.test(error.message);
  }
  return false;
}

export function getLoginErrorMessage(error: unknown, locale: Locale) {
  const messages = messagesFor(locale);

  if (isNetworkError(error)) return messages.network;

  if (error instanceof ApiError) {
    if (error.code === 'WRONG_CREDENTIALS' || (error.status === 401 && error.message === 'Incorrect email or password')) {
      return messages.wrongCredentials;
    }
    if (error.code === 'ACCOUNT_UNVERIFIED') return messages.accountUnverified;
    if (error.code === 'ACCOUNT_DISABLED' || /disabled|blocked|inactive/i.test(error.message)) {
      return messages.accountDisabled;
    }
    if (
      error.code === 'SESSION_VERIFICATION_FAILED'
      || error.code === 'INVALID_ACCESS_TOKEN'
      || error.code === 'INVALID_REFRESH_TOKEN'
      || error.code === 'NO_REFRESH_TOKEN'
    ) {
      return messages.session;
    }
    if (error.status >= 500) return messages.server;
  }

  return messages.fallback;
}
