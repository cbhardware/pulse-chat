# Frontend Wiring Guide

## Web (React)

Use these files:

- `authApi.ts`
- `web/tokenStore.ts`
- `web/authSession.ts`
- `web/authedFetch.ts`
- `web/socket.ts`

Behavior:

- Tokens are stored in `localStorage`.
- Socket reconnects automatically after refresh.
- Joined groups are rejoined on reconnect.

## React Native

Use these files:

- `authApi.ts`
- `react-native/tokenStore.ts`
- `react-native/authSession.ts`
- `react-native/authedFetch.ts`
- `react-native/socket.ts`

Behavior:

- Tokens are stored in `@react-native-async-storage/async-storage`.
- There is an in-memory token cache so `AuthSocketManager` can read tokens synchronously.
- Update `API_BASE_URL` to your machine LAN IP for device testing.

Install requirement for React Native:

```bash
npm install @react-native-async-storage/async-storage socket.io-client
```

## Suggested Flow

1. On signup/login, call `signUpAndStore` or `loginAndStore`.
2. Create socket with `connectAuthedSocket`.
3. Call `joinGroup(groupId)` when opening a chat.
4. If needed, call `fetchMe` to hydrate profile state.
5. On logout, call `logoutAndClear`, then disconnect socket.

## Authenticated API Requests

Use the stack-specific `authedFetch` helper for API calls that require bearer auth.

- Web: import from `web/authedFetch.ts`
- React Native: import from `react-native/authedFetch.ts`

Behavior:

1. Adds Authorization header with current access token.
2. On 401, calls refresh once and retries request once.
3. If refresh or retry fails, clears local tokens.

## Web Quick Start

```ts
import { loginAndStore, logoutAndClear } from './web/authSession';
import { connectAuthedSocket, disconnectSocket, joinGroup } from './web/socket';

await loginAndStore({ phoneNumber: '+15551234567', password: 'password123' });
const socket = connectAuthedSocket(() => {
	// route to login screen
});

joinGroup('your-group-id');

socket.on('new_message', (message) => {
	console.log(message);
});

await logoutAndClear();
disconnectSocket();
```

## React Native Quick Start

```ts
import { loginAndStore, logoutAndClear } from './react-native/authSession';
import { connectAuthedSocket, disconnectSocket, joinGroup } from './react-native/socket';

await loginAndStore({ phoneNumber: '+15551234567', password: 'password123' });
const socket = await connectAuthedSocket(() => {
	// navigate to login screen
});

joinGroup('your-group-id');

socket.on('new_message', (message) => {
	console.log(message);
});

await logoutAndClear();
disconnectSocket();
```
