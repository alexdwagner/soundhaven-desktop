import jwt from 'jsonwebtoken';
import { config } from '../config';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

export function generateJWT(userId: number): string {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function generateRefreshToken(userId: number): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; type?: string };
    return { userId: payload.userId };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}
