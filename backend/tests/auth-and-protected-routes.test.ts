import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
  },
};

vi.mock('../src/db/prisma.js', () => ({
  default: prismaMock,
}));

describe('Auth and protected route wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns health response', async () => {
    const { createApp } = await import('../src/app.js');
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('rejects invalid signup payloads', async () => {
    const { createApp } = await import('../src/app.js');
    const app = createApp();

    const response = await request(app).post('/api/v1/auth/signup').send({ phoneNumber: '+15550000' });

    expect(response.status).toBe(400);
  });

  it('rejects invalid login payloads', async () => {
    const { createApp } = await import('../src/app.js');
    const app = createApp();

    const response = await request(app).post('/api/v1/auth/login').send({ phoneNumber: '+15550000' });

    expect(response.status).toBe(400);
  });

  it('requires auth on /api/v1/auth/me', async () => {
    const { createApp } = await import('../src/app.js');
    const app = createApp();

    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
  });

  it('returns profile when auth token is valid', async () => {
    const { createApp } = await import('../src/app.js');
    const { signAuthToken } = await import('../src/services/authService.js');
    const app = createApp();

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user_123',
      phoneNumber: '+15551234567',
      name: 'Test User',
      avatarUrl: null,
      isAppUser: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const token = signAuthToken({
      sub: 'user_123',
      phoneNumber: '+15551234567',
    });

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe('user_123');
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('requires auth on core API routes', async () => {
    const { createApp } = await import('../src/app.js');
    const app = createApp();

    const response = await request(app).get('/api/v1/groups');

    expect(response.status).toBe(401);
  });
});
