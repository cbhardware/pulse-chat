import express, { Request, Response, Router } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { hashPassword, verifyPassword } from '../services/authService.js';
import { authWriteLimiter } from '../middleware/rateLimit.js';
import {
  issueTokenPair,
  revokeRefreshToken,
  rotateTokenPair,
} from '../services/refreshTokenService.js';

const router: Router = express.Router();

const signUpSchema = z.object({
  phoneNumber: z.string().min(7).max(20),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional(),
});

const signInSchema = z.object({
  phoneNumber: z.string().min(7).max(20),
  password: z.string().min(8).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post('/signup', authWriteLimiter, async (req: Request, res: Response) => {
  const parsed = signUpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body.', details: parsed.error.issues });
  }

  const { phoneNumber, password, name } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { phoneNumber } });
    const passwordHash = await hashPassword(password);

    let user;
    if (existing && existing.passwordHash) {
      return res.status(409).json({ error: 'An app account with this phone number already exists.' });
    }

    if (existing) {
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          isAppUser: true,
          passwordHash,
          name: name || existing.name,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          phoneNumber,
          name,
          isAppUser: true,
          passwordHash,
        },
      });
    }

    const { accessToken, refreshToken } = await issueTokenPair(user.id, user.phoneNumber);
    return res.status(201).json({
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        isAppUser: user.isAppUser,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to create account.' });
  }
});

router.post('/login', authWriteLimiter, async (req: Request, res: Response) => {
  const parsed = signInSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body.', details: parsed.error.issues });
  }

  const { phoneNumber, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid phone number or password.' });
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid phone number or password.' });
    }

    const { accessToken, refreshToken } = await issueTokenPair(user.id, user.phoneNumber);
    return res.json({
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        isAppUser: user.isAppUser,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to sign in.' });
  }
});

router.post('/refresh', authWriteLimiter, async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body.', details: parsed.error.issues });
  }

  try {
    const { accessToken, refreshToken } = await rotateTokenPair(parsed.data.refreshToken);
    return res.json({
      token: accessToken,
      accessToken,
      refreshToken,
    });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
});

router.post('/logout', requireAuth, authWriteLimiter, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body.', details: parsed.error.issues });
  }

  try {
    await revokeRefreshToken(parsed.data.refreshToken, authReq.userId);
    return res.json({ loggedOut: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to logout.' });
  }
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const user = await prisma.user.findUnique({
      where: { id: authReq.userId },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        avatarUrl: true,
        isAppUser: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

export default router;
