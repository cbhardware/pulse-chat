import type { AuthUser, Group, Message, TokenPair } from '../types';
import { API_BASE_URL } from './config';
import { clearTokens, getTokens, saveTokens } from './tokenStore';

type AuthResponse = {
  token: string;
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Request failed (${response.status})`);
  }
  return JSON.parse(text) as T;
}

export async function signup(input: {
  phoneNumber: string;
  password: string;
  name?: string;
}): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return parseJson<AuthResponse>(response);
}

export async function login(input: {
  phoneNumber: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return parseJson<AuthResponse>(response);
}

export async function refreshTokenPair(refreshToken: string): Promise<TokenPair> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const payload = await parseJson<{ accessToken?: string; token?: string; refreshToken: string }>(response);
  const accessToken = payload.accessToken || payload.token;
  if (!accessToken || !payload.refreshToken) {
    throw new Error('Refresh response missing tokens.');
  }

  return { accessToken, refreshToken: payload.refreshToken };
}

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const current = getTokens();
  if (!current?.accessToken) throw new Error('No access token available.');

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${current.accessToken}`);

  let response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (response.status !== 401) return response;

  if (!current.refreshToken) {
    clearTokens();
    return response;
  }

  try {
    const next = await refreshTokenPair(current.refreshToken);
    saveTokens(next);

    const retryHeaders = new Headers(init.headers || {});
    retryHeaders.set('Authorization', `Bearer ${next.accessToken}`);
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: retryHeaders });

    if (response.status === 401) {
      clearTokens();
    }

    return response;
  } catch {
    clearTokens();
    return response;
  }
}

export async function getMe(): Promise<AuthUser> {
  const response = await authedFetch('/api/v1/auth/me');
  return parseJson<AuthUser>(response);
}

export async function getGroups(): Promise<Group[]> {
  const response = await authedFetch('/api/v1/groups');
  return parseJson<Group[]>(response);
}

export async function createGroup(input: {
  name: string;
  description?: string;
  smsPhoneNumbers?: string[];
}): Promise<Group> {
  const response = await authedFetch('/api/v1/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return parseJson<Group>(response);
}

export async function getMessages(groupId: string): Promise<Message[]> {
  const response = await authedFetch(`/api/v1/groups/${groupId}/messages`);
  return parseJson<Message[]>(response);
}

export async function sendMessage(groupId: string, input: {
  content?: string;
  messageType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  mediaUrl?: string;
  mediaMimeType?: string;
}): Promise<Message> {
  const response = await authedFetch(`/api/v1/groups/${groupId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return parseJson<Message>(response);
}

export async function uploadMedia(file: File): Promise<{ url: string; key: string; mimeType: string; size: number }> {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/v1/media/upload`, {
    method: 'POST',
    body: form,
  });

  return parseJson<{ url: string; key: string; mimeType: string; size: number }>(response);
}
