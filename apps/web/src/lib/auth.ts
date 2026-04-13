'use client';

import { authApi, setAccessToken } from './api';

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
  return result;
}

export async function doRegister(email: string, password: string, name: string) {
  const result = await authApi.register({ email, password, name });
  setAccessToken(result.accessToken);
  return result;
}

export async function doLogout() {
  await authApi.logout().catch(() => {});
  setAccessToken(null);
}
