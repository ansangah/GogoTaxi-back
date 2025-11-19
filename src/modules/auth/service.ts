import { createHash } from 'crypto';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcrypt';
import { SignUpDto, LoginDto, RefreshTokenDto } from './dto';
import { issueAccessToken, issueRefreshToken, verifyRefreshJwt } from '../../lib/jwt';
import { ENV } from '../../config/env';

const SALT_ROUNDS = ENV.BCRYPT_SALT_ROUNDS;

type RequestMeta = {
  userAgent?: string;
  ip?: string;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function pickSafeUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    createdAt: user.createdAt
  };
}

async function createSession(user: { id: string; email: string; nickname: string; createdAt: Date }, meta: RequestMeta) {
  const access = issueAccessToken({ sub: user.id, email: user.email });
  const refresh = issueRefreshToken({ sub: user.id, email: user.email });
  const tokenHash = hashToken(refresh.token);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: refresh.expiresAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      userAgent: meta.userAgent,
      ip: meta.ip
    }
  });

  return {
    user: pickSafeUser(user),
    accessToken: access.token,
    refreshToken: refresh.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshTokenExpiresAt: refresh.expiresAt
  };
}

export async function signUp(input: SignUpDto, meta: RequestMeta) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) {
    throw new Error('EMAIL_TAKEN');
  }
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      nickname: input.nickname
    },
    select: { id: true, email: true, nickname: true, createdAt: true }
  });

  return createSession(user, meta);
}

export async function login(input: LoginDto, meta: RequestMeta) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(user as any).passwordHash) throw new Error('INVALID_CREDENTIALS');

  const ok = await bcrypt.compare(input.password, (user as any).passwordHash);
  if (!ok) throw new Error('INVALID_CREDENTIALS');

  const safeUser = pickSafeUser(user);
  return createSession(safeUser as any, meta);
}

export async function refreshTokens(input: RefreshTokenDto, meta: RequestMeta) {
  const payload = verifyRefreshJwt(input.refreshToken);
  const tokenHash = hashToken(input.refreshToken);

  const existing = await prisma.refreshToken.findFirst({
    where: {
      userId: payload.sub,
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() }
    }
  });
  if (!existing) throw new Error('INVALID_REFRESH');

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), revokedReason: 'ROTATED' }
  });

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, nickname: true, createdAt: true }
  });
  if (!user) throw new Error('USER_NOT_FOUND');

  return createSession(user, meta);
}

export async function logout(input: RefreshTokenDto) {
  const payload = verifyRefreshJwt(input.refreshToken);
  const tokenHash = hashToken(input.refreshToken);

  const existing = await prisma.refreshToken.findFirst({
    where: {
      userId: payload.sub,
      tokenHash,
      revokedAt: null
    }
  });
  if (!existing) throw new Error('INVALID_REFRESH');

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), revokedReason: 'LOGOUT' }
  });
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nickname: true,
      createdAt: true,
      phone: true,
      gender: true
    }
  });
  if (!user) throw new Error('USER_NOT_FOUND');
  return user;
}
