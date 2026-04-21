'use client';

import { ApiError, authApi, setAccessToken } from './api';

// Try to refresh access token using the httpOnly cookie.
// Called on app mount to restore auth session across page reloads.
export async function tryRefreshSession(): Promise<{ user: any; accessToken: string } | null> {
  try {
    const { accessToken } = await authApi.refresh();
    setAccessToken(accessToken);
    const { user } = await authApi.me();
    return { user, accessToken };
  } catch {
    setAccessToken(null);
    return null;
  }
}

export async function doLogin(email: string, password: string) {
  const result = await authApi.login({ email, password });
  setAccessToken(result.accessToken);

  try {
    const { user } = await authApi.me();
    return { ...result, user };
  } catch (error) {
    setAccessToken(null);
    if (error instanceof ApiError) {
      throw new ApiError(error.status, 'SESSION_VERIFICATION_FAILED', error.details, 'SESSION_VERIFICATION_FAILED');
    }
    throw error;
  }
}

export async function doCompleteRegistration(email: string, registrationToken: string, password: string, name?: string) {
  const result = await authApi.completeRegistration({
    email,
    registrationToken,
    password,
    ...(name ? { name } : {}),
  });
  setAccessToken(result.accessToken);
  return result;
}

export async function doLogout() {
  await authApi.logout().catch(() => {});
  setAccessToken(null);
}
