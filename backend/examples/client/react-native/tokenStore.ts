import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TokenPair } from '../authSocketManager';

const TOKEN_STORAGE_KEY = 'pulsechat_tokens';

export async function getTokens(): Promise<TokenPair | null> {
  const raw = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
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

export async function saveTokens(tokens: TokenPair): Promise<void> {
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
}
