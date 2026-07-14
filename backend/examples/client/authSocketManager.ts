import { io, Socket } from 'socket.io-client';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type AuthSocketManagerOptions = {
  socketUrl: string;
  refreshUrl: string;
  getTokens: () => TokenPair | null;
  saveTokens: (tokens: TokenPair) => void;
  clearTokens?: () => void;
  onAuthFailure?: () => void;
  reconnectDelayMs?: number;
  maxRefreshRetries?: number;
};

export class AuthSocketManager {
  private socket: Socket | null = null;
  private readonly options: Required<
    Pick<AuthSocketManagerOptions, 'reconnectDelayMs' | 'maxRefreshRetries'>
  > & Omit<AuthSocketManagerOptions, 'reconnectDelayMs' | 'maxRefreshRetries'>;
  private joinedGroups = new Set<string>();
  private refreshRetries = 0;

  constructor(options: AuthSocketManagerOptions) {
    this.options = {
      ...options,
      reconnectDelayMs: options.reconnectDelayMs ?? 1500,
      maxRefreshRetries: options.maxRefreshRetries ?? 2,
    };
  }

  connect(): Socket {
    const tokens = this.options.getTokens();
    if (!tokens?.accessToken) {
      throw new Error('Missing access token. Log in before connecting socket.');
    }

    this.socket = io(this.options.socketUrl, {
      transports: ['websocket'],
      auth: { token: tokens.accessToken },
      autoConnect: true,
    });

    this.wireCoreHandlers(this.socket);
    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinGroup(groupId: string): void {
    if (!groupId) return;
    this.joinedGroups.add(groupId);
    this.socket?.emit('join_group', groupId);
  }

  leaveGroup(groupId: string): void {
    if (!groupId) return;
    this.joinedGroups.delete(groupId);
    this.socket?.emit('leave_group', groupId);
  }

  private wireCoreHandlers(socket: Socket): void {
    socket.on('connect', () => {
      this.refreshRetries = 0;
      for (const groupId of this.joinedGroups) {
        socket.emit('join_group', groupId);
      }
    });

    socket.on('connect_error', async (err: Error) => {
      const message = err?.message?.toLowerCase() || '';
      const unauthorized = message.includes('unauthorized') || message.includes('invalid token');

      if (!unauthorized) {
        return;
      }

      try {
        await this.refreshTokensAndReconnect();
      } catch {
        this.options.clearTokens?.();
        this.options.onAuthFailure?.();
      }
    });
  }

  private async refreshTokensAndReconnect(): Promise<void> {
    if (this.refreshRetries >= this.options.maxRefreshRetries) {
      throw new Error('Max refresh retries exceeded.');
    }

    this.refreshRetries += 1;

    const current = this.options.getTokens();
    if (!current?.refreshToken) {
      throw new Error('Missing refresh token.');
    }

    const response = await fetch(this.options.refreshUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed with status ${response.status}.`);
    }

    const data = (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
      token?: string;
    };

    const nextAccessToken = data.accessToken || data.token;
    const nextRefreshToken = data.refreshToken;

    if (!nextAccessToken || !nextRefreshToken) {
      throw new Error('Refresh endpoint did not return both tokens.');
    }

    this.options.saveTokens({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
    });

    if (this.socket) {
      this.socket.disconnect();
      this.socket.auth = { token: nextAccessToken };
      await new Promise((resolve) => setTimeout(resolve, this.options.reconnectDelayMs));
      this.socket.connect();
    }
  }
}
