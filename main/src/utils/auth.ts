import { and, eq, gte } from 'drizzle-orm';
import { db } from '../db';
import { users, refreshTokens } from '../schema';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { sql } from 'drizzle-orm/sql';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Password hashing
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Password verification
export const verifyPassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  if (!password || !hashedPassword) return false;
  return await bcrypt.compare(password, hashedPassword);
};

// Generate JWT token
export function generateJWT(userId: number): string {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { 
      expiresIn: JWT_EXPIRES_IN,
      algorithm: 'HS256' 
    } as jwt.SignOptions
  );
}

// Generate refresh token
export function generateRefreshToken(userId: number): string {
  return jwt.sign(
    { 
      userId, 
      type: 'refresh',
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    },
    JWT_SECRET,
    { 
      algorithm: 'HS256' 
    } as jwt.SignOptions
  );
}

// Verify JWT token
export function verifyToken(token: string): { userId: number } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; type?: string };
    return { userId: payload.userId };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

interface TokenPayload extends jwt.JwtPayload {
  userId: number;
  type?: string;
}

// Refresh JWT token using a refresh token
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  if (!refreshToken) {
    throw new Error('No refresh token provided');
  }

  try {
    // Verify the refresh token
    const payload = jwt.verify(refreshToken, JWT_SECRET) as TokenPayload;
    
    if (!payload.userId || payload.type !== 'refresh') {
      throw new Error('Invalid token payload');
    }

    // Check if the refresh token exists in the database and is not expired
    const [tokenRecord] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, refreshToken),
          gte(refreshTokens.expiresIn, Math.floor(Date.now() / 1000))
        )
      );

    if (!tokenRecord) {
      throw new Error('Invalid or expired refresh token');
    }

    // Generate new tokens
    const newAccessToken = generateJWT(payload.userId);
    const newRefreshToken = generateRefreshToken(payload.userId);
    const newExpiresIn = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days from now

    // Update the refresh token in the database
    await db
      .update(refreshTokens)
      .set({ 
        token: newRefreshToken,
        expiresIn: newExpiresIn
      })
      .where(eq(refreshTokens.id, tokenRecord.id));

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    // Invalidate the refresh token if there's an error
    if (error instanceof Error) {
      if (error.message.includes('jwt expired')) {
        await invalidateRefreshToken(refreshToken);
      }
    }
    throw error; // Re-throw to be handled by the caller
  }
}

// Invalidate a refresh token (logout)
export async function invalidateRefreshToken(token: string): Promise<boolean> {
  if (!token) {
    console.warn('No token provided for invalidation');
    return false;
  }

  try {
    // First check if the token exists to avoid unnecessary DB operations
    const [existingToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, token))
      .limit(1);

    if (!existingToken) {
      console.warn('Token not found for invalidation');
      return false;
    }

    // Delete the token
    const result = await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.token, token));

    return result.changes > 0;
  } catch (error) {
    console.error('Error invalidating refresh token:', error);
    throw error; // Re-throw to be handled by the caller
  }
}

export { eq };
