import type { TokenPair } from '../authSocketManager';
import {
  clearTokens as clearStoredTokens,
  getTokens as getStoredTokens,
  saveTokens as saveStoredTokens,
} from './tokenStore';

const API_BASE_URL = 'http://YOUR_LAN_IP:3000';

let inMemoryTokens: TokenPair | null = null;

async function loadTokens(): Promise<TokenPair | null> {
  if (inMemoryTokens) {
    return inMemoryTokens;
  }

  inMemoryTokens = await getStoredTokens();
  return inMemoryTokens;
}

async function setTokens(tokens: TokenPair | null): Promise<void> {
  inMemoryTokens = tokens;
  if (tokens) {
    await saveStoredTokens(tokens);
  } else {
    await clearStoredTokens();
  }
}

async function refreshTokensOnce(): Promise<boolean> {
  const current = await loadTokens();
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

  await setTokens({ accessToken, refreshToken: data.refreshToken });
  return true;
}

export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const endpoint = input.startsWith('http') ? input : `${API_BASE_URL}${input}`;
  const tokens = await loadTokens();

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
    await setTokens(null);
    return response;
  }

  const nextTokens = await loadTokens();
  if (!nextTokens?.accessToken) {
    await setTokens(null);
    return response;
  }

  const retryHeaders = new Headers(init.headers || {});
  retryHeaders.set('Authorization', `Bearer ${nextTokens.accessToken}`);

  response = await fetch(endpoint, {
    ...init,
    headers: retryHeaders,
  });

  if (response.status === 401) {
    await setTokens(null);
  }

  return response;
}
