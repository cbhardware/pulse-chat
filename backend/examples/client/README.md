# Auth Socket Manager Example

This folder contains a reusable client-side helper for Socket.IO auth that matches the backend's JWT-protected socket handshake.

## Files

- `authSocketManager.ts`: class that handles connect, token refresh, reconnect, and optional room rejoin.

## Install in your frontend app

```bash
npm install socket.io-client
```

## Minimal usage

```ts
import { AuthSocketManager } from './authSocketManager';

let tokens = {
  accessToken: '<initial_access_token>',
  refreshToken: '<initial_refresh_token>',
};

const manager = new AuthSocketManager({
  socketUrl: 'http://localhost:3000',
  refreshUrl: 'http://localhost:3000/api/v1/auth/refresh',
  getTokens: () => tokens,
  saveTokens: (next) => {
    tokens = next;
  },
  clearTokens: () => {
    tokens = { accessToken: '', refreshToken: '' };
  },
  onAuthFailure: () => {
    // redirect to login screen
    console.log('Auth failed. Please log in again.');
  },
});

const socket = manager.connect();
manager.joinGroup('group-id-123');

socket.on('new_message', (message) => {
  console.log('new_message', message);
});
```

## Notes

- The helper expects backend refresh response to contain `accessToken` and `refreshToken`.
- It also accepts `token` as access token for compatibility.
- If refresh fails repeatedly, it calls `clearTokens` and `onAuthFailure`.
