import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { ENV } from '../config/env';

export type TokenType = 'access' | 'refresh';
export type AppJwtPayload = {
  sub: string;
  email: string;
  jti: string;
  type: TokenType;
};

const ACCESS_SECRET: jwt.Secret = ENV.JWT_SECRET;
const REFRESH_SECRET: jwt.Secret = ENV.JWT_REFRESH_SECRET;

const ACCESS_EXPIRES_IN: Exclude<jwt.SignOptions['expiresIn'], undefined> = ENV.JWT_ACCESS_EXPIRES_IN;
const REFRESH_EXPIRES_IN: Exclude<jwt.SignOptions['expiresIn'], undefined> = ENV.JWT_REFRESH_EXPIRES_IN;

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

function signToken(type: TokenType, payload: Pick<AppJwtPayload, 'sub' | 'email'>): SignResult {
  const jti = randomUUID();
  const tokenPayload: AppJwtPayload = { ...payload, type, jti };
  const secret = type === 'access' ? ACCESS_SECRET : REFRESH_SECRET;
  const expiresIn = type === 'access' ? ACCESS_EXPIRES_IN : REFRESH_EXPIRES_IN;
  const token = jwt.sign(tokenPayload as Record<string, unknown>, secret, { expiresIn });
  return { token, payload: tokenPayload, expiresAt: decodeExpiry(token) };
}

function verifyToken(type: TokenType, token: string): AppJwtPayload {
  const secret = type === 'access' ? ACCESS_SECRET : REFRESH_SECRET;
  const payload = jwt.verify(token, secret) as AppJwtPayload;
  if (payload.type !== type) {
    throw new Error('INVALID_TOKEN_TYPE');
  }
  return payload;
}

export function issueAccessToken(payload: Pick<AppJwtPayload, 'sub' | 'email'>) {
  return signToken('access', payload);
}

export function issueRefreshToken(payload: Pick<AppJwtPayload, 'sub' | 'email'>) {
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
