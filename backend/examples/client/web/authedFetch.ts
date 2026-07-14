import { clearTokens, getTokens, saveTokens } from './tokenStore';

const API_BASE_URL = 'http://localhost:3000';

async function refreshTokensOnce(): Promise<boolean> {
  const current = getTokens();
  if (!current?.refreshToken) {
    return false;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as {
    accessToken?: string;
    refreshToken?: string;
    token?: string;
  };

  const accessToken = data.accessToken || data.token;
  if (!accessToken || !data.refreshToken) {
    return false;
  }

  saveTokens({ accessToken, refreshToken: data.refreshToken });
  return true;
}

export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const endpoint = input.startsWith('http') ? input : `${API_BASE_URL}${input}`;
  const tokens = getTokens();

  if (!tokens?.accessToken) {
    throw new Error('No access token available.');
  }

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${tokens.accessToken}`);

  let response = await fetch(endpoint, {
    ...init,
    headers,
  });

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshTokensOnce();
  if (!refreshed) {
    clearTokens();
    return response;
  }

  const nextTokens = getTokens();
  if (!nextTokens?.accessToken) {
    clearTokens();
    return response;
  }

  const retryHeaders = new Headers(init.headers || {});
  retryHeaders.set('Authorization', `Bearer ${nextTokens.accessToken}`);

  response = await fetch(endpoint, {
    ...init,
    headers: retryHeaders,
  });

  if (response.status === 401) {
    clearTokens();
  }

  return response;
}
