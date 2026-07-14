import type { TokenPair } from './authSocketManager';

export type AuthUser = {
  id: string;
  phoneNumber: string;
  name: string | null;
  isAppUser: boolean;
  avatarUrl?: string | null;
};

export type AuthResponse = {
  token: string;
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type AuthApiClient = {
  signup: (input: { phoneNumber: string; password: string; name?: string }) => Promise<AuthResponse>;
  login: (input: { phoneNumber: string; password: string }) => Promise<AuthResponse>;
  refresh: (refreshToken: string) => Promise<TokenPair>;
  logout: (input: { accessToken: string; refreshToken: string }) => Promise<void>;
  me: (accessToken: string) => Promise<AuthUser>;
};

export function createAuthApi(baseUrl: string): AuthApiClient {
  const root = baseUrl.replace(/\/$/, '');

  async function postJson<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
    const response = await fetch(`${root}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Request failed (${response.status}) ${path}: ${text}`);
    }

    return (await response.json()) as T;
  }

  return {
    signup: (input) => postJson<AuthResponse>('/api/v1/auth/signup', input),
    login: (input) => postJson<AuthResponse>('/api/v1/auth/login', input),
    async refresh(refreshToken) {
      const data = await postJson<{ token?: string; accessToken?: string; refreshToken?: string }>(
        '/api/v1/auth/refresh',
        { refreshToken }
      );

      const accessToken = data.accessToken || data.token;
      if (!accessToken || !data.refreshToken) {
        throw new Error('Refresh response missing accessToken or refreshToken.');
      }

      return {
        accessToken,
        refreshToken: data.refreshToken,
      };
    },
    async logout({ accessToken, refreshToken }) {
      await postJson<{ loggedOut: boolean }>('/api/v1/auth/logout', { refreshToken }, accessToken);
    },
    async me(accessToken) {
      const response = await fetch(`${root}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Request failed (${response.status}) /api/v1/auth/me: ${text}`);
      }

      return (await response.json()) as AuthUser;
    },
  };
}
