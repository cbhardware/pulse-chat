import { createAuthApi } from '../authApi';
import type { TokenPair } from '../authSocketManager';
import { clearTokens, getTokens, saveTokens } from './tokenStore';

const API_BASE_URL = 'http://localhost:3000';
const authApi = createAuthApi(API_BASE_URL);

export async function signUpAndStore(input: {
  phoneNumber: string;
  password: string;
  name?: string;
}): Promise<{ userId: string }> {
  const response = await authApi.signup(input);
  saveTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
  return { userId: response.user.id };
}

export async function loginAndStore(input: {
  phoneNumber: string;
  password: string;
}): Promise<{ userId: string }> {
  const response = await authApi.login(input);
  saveTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
  return { userId: response.user.id };
}

export async function refreshAndStore(): Promise<TokenPair> {
  const current = getTokens();
  if (!current?.refreshToken) {
    throw new Error('No refresh token available.');
  }

  const next = await authApi.refresh(current.refreshToken);
  saveTokens(next);
  return next;
}

export async function logoutAndClear(): Promise<void> {
  const current = getTokens();
  if (current?.accessToken && current.refreshToken) {
    try {
      await authApi.logout({
        accessToken: current.accessToken,
        refreshToken: current.refreshToken,
      });
    } catch {
      // Always clear local session on logout, even if API call fails.
    }
  }

  clearTokens();
}

export async function fetchMe() {
  const current = getTokens();
  if (!current?.accessToken) {
    throw new Error('No access token available.');
  }

  return authApi.me(current.accessToken);
}
