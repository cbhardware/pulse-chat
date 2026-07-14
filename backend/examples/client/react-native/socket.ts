import type { Socket } from 'socket.io-client';
import { AuthSocketManager, type TokenPair } from '../authSocketManager';
import {
  clearTokens as clearTokensFromStorage,
  getTokens as getTokensFromStorage,
  saveTokens as saveTokensToStorage,
} from './tokenStore';

const API_BASE_URL = 'http://YOUR_LAN_IP:3000';

let manager: AuthSocketManager | null = null;
let inMemoryTokens: TokenPair | null = null;

async function getTokens(): Promise<TokenPair | null> {
  if (inMemoryTokens) {
    return inMemoryTokens;
  }

  inMemoryTokens = await getTokensFromStorage();
  return inMemoryTokens;
}

function getTokensSync(): TokenPair | null {
  return inMemoryTokens;
}

function saveTokens(tokens: TokenPair): void {
  inMemoryTokens = tokens;
  void saveTokensToStorage(tokens);
}

function clearTokens(): void {
  inMemoryTokens = null;
  void clearTokensFromStorage();
}

export async function connectAuthedSocket(onAuthFailure: () => void): Promise<Socket> {
  inMemoryTokens = await getTokens();

  manager = new AuthSocketManager({
    socketUrl: API_BASE_URL,
    refreshUrl: `${API_BASE_URL}/api/v1/auth/refresh`,
    getTokens: getTokensSync,
    saveTokens,
    clearTokens,
    onAuthFailure,
  });

  return manager.connect();
}

export function joinGroup(groupId: string): void {
  manager?.joinGroup(groupId);
}

export function leaveGroup(groupId: string): void {
  manager?.leaveGroup(groupId);
}

export function disconnectSocket(): void {
  manager?.disconnect();
}
