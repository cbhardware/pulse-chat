import type { Socket } from 'socket.io-client';
import { AuthSocketManager } from '../authSocketManager';
import { clearTokens, getTokens, saveTokens } from './tokenStore';

const API_BASE_URL = 'http://localhost:3000';

let manager: AuthSocketManager | null = null;

export function connectAuthedSocket(onAuthFailure: () => void): Socket {
  manager = new AuthSocketManager({
    socketUrl: API_BASE_URL,
    refreshUrl: `${API_BASE_URL}/api/v1/auth/refresh`,
    getTokens,
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
