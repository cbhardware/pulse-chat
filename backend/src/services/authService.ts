import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const SALT_ROUNDS = 12;

export type AuthTokenPayload = {
  sub: string;
  phoneNumber: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAuthToken(payload: AuthTokenPayload): string {
  const expiresIn = env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn,
  });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string' || !decoded.sub || !decoded.phoneNumber) {
    throw new Error('Invalid token payload');
  }

  return {
    sub: decoded.sub,
    phoneNumber: decoded.phoneNumber,
  };
}
