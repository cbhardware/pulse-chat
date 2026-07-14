import crypto from 'crypto';
import prisma from '../db/prisma.js';
import { env } from '../config/env.js';
import { signAuthToken } from './authService.js';
import jwt from 'jsonwebtoken';

type RefreshPayload = {
  sub: string;
  type: 'refresh';
};

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signRefreshToken(userId: string): string {
  const expiresIn = env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'];
  return jwt.sign({ sub: userId, type: 'refresh' } satisfies RefreshPayload, env.JWT_REFRESH_SECRET, {
    expiresIn,
  });
}

function verifyRefreshToken(token: string): RefreshPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (typeof decoded === 'string' || decoded.type !== 'refresh' || !decoded.sub) {
    throw new Error('Invalid refresh token payload');
  }
  return { sub: decoded.sub, type: 'refresh' };
}

export async function issueTokenPair(userId: string, phoneNumber: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const refreshToken = signRefreshToken(userId);
  const tokenHash = hashToken(refreshToken);
  const decoded = jwt.decode(refreshToken) as { exp?: number } | null;

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date((decoded?.exp || 0) * 1000),
    },
  });

  return {
    accessToken: signAuthToken({ sub: userId, phoneNumber }),
    refreshToken,
  };
}

export async function rotateTokenPair(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
    throw new Error('Refresh token is invalid or expired.');
  }

  if (stored.userId !== payload.sub) {
    throw new Error('Refresh token subject mismatch.');
  }

  const nextRefreshToken = signRefreshToken(stored.userId);
  const nextTokenHash = hashToken(nextRefreshToken);
  const decodedNext = jwt.decode(nextRefreshToken) as { exp?: number } | null;

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: nextTokenHash,
        expiresAt: new Date((decodedNext?.exp || 0) * 1000),
      },
    }),
  ]);

  return {
    accessToken: signAuthToken({ sub: stored.user.id, phoneNumber: stored.user.phoneNumber }),
    refreshToken: nextRefreshToken,
  };
}

export async function revokeRefreshToken(refreshToken: string, userId: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);

  await prisma.refreshToken.updateMany({
    where: {
      userId,
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
