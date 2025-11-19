import { Router } from 'express';
import { SignUpDto, LoginDto, RefreshTokenDto } from './dto';
import { signUp, login, refreshTokens, logout } from './service';

export const authRouter = Router();

const parseRequestMeta = (req: any) => ({
  userAgent: req.get?.('user-agent') ?? undefined,
  ip: (typeof req.ip === 'string' ? req.ip : undefined) ?? req.socket?.remoteAddress ?? undefined
});

authRouter.post('/signup', async (req, res) => {
  try {
    const input = SignUpDto.parse(req.body);
    const result = await signUp(input, parseRequestMeta(req));
    res.status(201).json(result);
  } catch (e: any) {
    if (e?.message === 'EMAIL_TAKEN') return res.status(409).json({ message: 'Email already in use' });
    if (e?.name === 'ZodError') return res.status(400).json({ message: 'Validation failed', issues: e.issues });
    console.error(e);
    res.status(500).json({ message: 'Internal error' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const input = LoginDto.parse(req.body);
    const result = await login(input, parseRequestMeta(req));
    res.json(result);
  } catch (e: any) {
    if (e?.message === 'INVALID_CREDENTIALS') return res.status(401).json({ message: 'Invalid email or password' });
    if (e?.name === 'ZodError') return res.status(400).json({ message: 'Validation failed', issues: e.issues });
    console.error(e);
    res.status(500).json({ message: 'Internal error' });
  }
});

authRouter.post('/refresh', async (req, res) => {
  try {
    const input = RefreshTokenDto.parse(req.body);
    const result = await refreshTokens(input, parseRequestMeta(req));
    res.json(result);
  } catch (e: any) {
    if (e?.message === 'INVALID_REFRESH' || e?.message === 'INVALID_TOKEN_TYPE') {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
    if (e?.name === 'ZodError') return res.status(400).json({ message: 'Validation failed', issues: e.issues });
    console.error(e);
    res.status(500).json({ message: 'Internal error' });
  }
});

authRouter.post('/logout', async (req, res) => {
  try {
    const input = RefreshTokenDto.parse(req.body);
    await logout(input);
    res.json({ success: true });
  } catch (e: any) {
    if (e?.message === 'INVALID_REFRESH' || e?.message === 'INVALID_TOKEN_TYPE') {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
    if (e?.name === 'ZodError') return res.status(400).json({ message: 'Validation failed', issues: e.issues });
    console.error(e);
    res.status(500).json({ message: 'Internal error' });
  }
});
