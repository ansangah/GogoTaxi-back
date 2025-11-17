import { Router } from 'express';
import { authRouter } from '../modules/auth/routes.ts';
export const router = Router();
router.get('/health', (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
});
router.use('/auth', authRouter);
