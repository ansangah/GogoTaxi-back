import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { ENV } from '../config/env';

export type TokenType = 'access' | 'refresh';
export type AppJwtPayload = {
  sub: string;
  loginId: string;
  jti: string;
  type: TokenType;
};
export type SocialPendingPayload = {
  sub: string;
  loginId: string;
  provider: string;
  jti: string;
  type: 'social_pending';
};

const ACCESS_SECRET: jwt.Secret = ENV.JWT_SECRET;
const REFRESH_SECRET: jwt.Secret = ENV.JWT_REFRESH_SECRET;
const SOCIAL_PENDING_SECRET: jwt.Secret = ENV.JWT_SECRET;

const ACCESS_EXPIRES_IN = ENV.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'];
const REFRESH_EXPIRES_IN = ENV.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'];
const SOCIAL_PENDING_EXPIRES_IN = '30m' as jwt.SignOptions['expiresIn'];

type SignResult = {
  token: string;
  payload: AppJwtPayload;
  expiresAt: Date | null;
};

function decodeExpiry(token: string): Date | null {
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  if (!decoded?.exp) return null;
  return new Date(decoded.exp * 1000);
}

function signToken(type: TokenType, payload: Pick<AppJwtPayload, 'sub' | 'loginId'>): SignResult {
  const jti = randomUUID();
  const tokenPayload: AppJwtPayload = { ...payload, type, jti };
  const secret = type === 'access' ? ACCESS_SECRET : REFRESH_SECRET;
  const expiresIn = type === 'access' ? ACCESS_EXPIRES_IN : REFRESH_EXPIRES_IN;
  const token = jwt.sign(tokenPayload as Record<string, unknown>, secret, { expiresIn });
  return { token, payload: tokenPayload, expiresAt: decodeExpiry(token) };
}

function verifyToken(type: TokenType, token: string): AppJwtPayload {
  const secret = type === 'access' ? ACCESS_SECRET : REFRESH_SECRET;
  const payload = jwt.verify(token, secret) as Partial<AppJwtPayload> & Record<string, any>;

  // Legacy tokens might not include the `type`/`loginId`/`jti` fields.
  const payloadType = (payload.type as TokenType | undefined) ?? type;
  if (payloadType !== type) {
    throw new Error('INVALID_TOKEN_TYPE');
  }
  if (!payload.loginId) {
    // Fall back to any identifier we can find; sub is guaranteed for JWTs we issue.
    payload.loginId =
      typeof payload.sub === 'string' && payload.sub.length > 0
        ? payload.sub
        : (payload.email as string | undefined) ?? 'unknown';
  }
  if (!payload.jti) {
    payload.jti = `legacy-${payload.sub ?? 'unknown'}`;
  }
  payload.type = payloadType;
  return payload as AppJwtPayload;
}

export function issueAccessToken(payload: Pick<AppJwtPayload, 'sub' | 'loginId'>) {
  return signToken('access', payload);
}

export function issueRefreshToken(payload: Pick<AppJwtPayload, 'sub' | 'loginId'>) {
  return signToken('refresh', payload);
}

export function verifyAccessJwt(token: string): AppJwtPayload {
  return verifyToken('access', token);
}

export function verifyRefreshJwt(token: string): AppJwtPayload {
  return verifyToken('refresh', token);
}

export function getExpiryDate(token: string): Date | null {
  return decodeExpiry(token);
}

export function issueSocialPendingToken(payload: Pick<SocialPendingPayload, 'sub' | 'loginId' | 'provider'>) {
  const jti = randomUUID();
  const tokenPayload: SocialPendingPayload = { ...payload, jti, type: 'social_pending' };
  const token = jwt.sign(tokenPayload as Record<string, unknown>, SOCIAL_PENDING_SECRET, {
    expiresIn: SOCIAL_PENDING_EXPIRES_IN
  });
  return { token, payload: tokenPayload, expiresAt: decodeExpiry(token) };
}

export function verifySocialPendingToken(token: string): SocialPendingPayload {
  const payload = jwt.verify(token, SOCIAL_PENDING_SECRET) as SocialPendingPayload;
  if (payload.type !== 'social_pending') {
    throw new Error('INVALID_TOKEN_TYPE');
  }
  return payload;
}
