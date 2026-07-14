const apiBaseFromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const API_BASE_URL = (apiBaseFromEnv || 'http://localhost:3000').replace(/\/$/, '');

export const SOCKET_URL = API_BASE_URL;
export const STORAGE_KEY = 'pulsechat_tokens';
