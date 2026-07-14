import type { TokenPair } from '../types';
import { STORAGE_KEY } from './config';

export function getTokens(): TokenPair | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as TokenPair;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: TokenPair): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
