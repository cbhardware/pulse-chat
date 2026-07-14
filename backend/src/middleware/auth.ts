import { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../services/authService.js';

export type AuthenticatedRequest = Request & {
  userId: string;
  userPhoneNumber: string;
};

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.header('authorization');
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    return;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token.' });
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    const authReq = req as AuthenticatedRequest;
    authReq.userId = payload.sub;
    authReq.userPhoneNumber = payload.phoneNumber;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
