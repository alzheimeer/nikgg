import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser, getUserByUid } from '../db/users.ts';
import type { UserRole } from '../engine/nikBracketsEngine.ts';

const LOCAL_TOKEN_SECRET =
  process.env.LOCAL_JWT_SECRET || 'nikbrackets-pro-cloudsql-hmac-2026-secret';

export interface AuthenticatedUserRecord {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  gamerTag: string;
  avatarUrl: string | null;
  authProvider: string;
  globalRole: UserRole;
  eloRating: number;
  mainCharacter: string | null;
  country: string | null;
  city?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  discordHandle?: string | null;
  twitchHandle?: string | null;
  profileCompleted?: boolean;
  teamName: string | null;
  accountStatus: string;
  twoFactorEnabled: boolean;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: AuthenticatedUserRecord;
}

export function signLocalSessionToken(payload: {
  uid: string;
  email: string;
  displayName: string;
}): string {
  const data = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };
  const base64Payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', LOCAL_TOKEN_SECRET)
    .update(base64Payload)
    .digest('base64url');
  return `niklocal.${base64Payload}.${signature}`;
}

export function verifyLocalSessionToken(token: string): {
  uid: string;
  email: string;
  displayName: string;
} | null {
  if (!token.startsWith('niklocal.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, base64Payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', LOCAL_TOKEN_SECRET)
    .update(base64Payload)
    .digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf-8'));
    if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      uid: parsed.uid,
      email: parsed.email,
      displayName: parsed.displayName,
    };
  } catch {
    return null;
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    // Support local PostgreSQL Email/Password session token fallback if issued by /api/auth/login-email
    if (token.startsWith('niklocal.')) {
      const localClaims = verifyLocalSessionToken(token);
      if (!localClaims) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
      }
      const existing = await getUserByUid(localClaims.uid);
      const synced =
        existing ||
        (await getOrCreateUser({
          uid: localClaims.uid,
          email: localClaims.email,
          displayName: localClaims.displayName,
          authProvider: 'email',
        }));

      if (synced.accountStatus === 'SUSPENDED') {
        return res.status(403).json({ error: 'Forbidden: Account is suspended' });
      }

      req.user = {
        uid: synced.uid,
        email: synced.email,
        name: synced.displayName,
      } as unknown as DecodedIdToken;
      req.dbUser = synced as AuthenticatedUserRecord;
      return next();
    }

    // Standard Firebase Auth ID Token verification (Google Sign-In & Firebase Email/Password)
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    const synced = await getOrCreateUser({
      uid: decodedToken.uid,
      email: decodedToken.email || `${decodedToken.uid}@firebase.user`,
      displayName: decodedToken.name || decodedToken.email?.split('@')[0] || 'Player',
      avatarUrl: decodedToken.picture || null,
      authProvider:
        decodedToken.firebase?.sign_in_provider === 'password' ? 'email' : 'google',
    });

    if (synced.accountStatus === 'SUSPENDED') {
      return res.status(403).json({ error: 'Forbidden: Account is suspended' });
    }

    req.dbUser = synced as AuthenticatedUserRecord;
    return next();
  } catch (error) {
    console.error('Error verifying authentication token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
