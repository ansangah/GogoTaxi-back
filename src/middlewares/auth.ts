import type { Request, Response, NextFunction } from 'express';
import { verifyAccessJwt } from '../lib/jwt';
import type { AppJwtPayload } from '../lib/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: AppJwtPayload;
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization; // "Bearer <token>"
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: missing Bearer token' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAccessJwt(token);
    req.user = payload;
    req.userId = payload.sub;
    next();
  } catch (err: any) {
    const message = err?.message === 'INVALID_TOKEN_TYPE' ? 'Unauthorized: invalid token type' : 'Unauthorized: invalid token';
    return res.status(401).json({ message });
  }
}
