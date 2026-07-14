import type { TokenPair } from '../authSocketManager';

const TOKEN_STORAGE_KEY = 'pulsechat_tokens';

export function getTokens(): TokenPair | null {
  const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as TokenPair;
    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: TokenPair): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}
