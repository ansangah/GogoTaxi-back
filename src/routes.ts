import { Router } from 'express';
import { authRouter } from './modules/auth/routes';
import { requireAuth } from './middlewares/auth';
import { getProfile } from './modules/auth/service';

export const router = Router();

// 상태 확인
router.get('/', (_req, res) => res.json({ message: 'GogoTaxi backend up' }));

// 인증 관련
router.use('/auth', authRouter);

// 보호 API 예시
router.get('/me', requireAuth, async (req, res) => {
  try {
    const me = await getProfile(req.userId!);
    res.json({ me });
  } catch (e: any) {
    if (e?.message === 'USER_NOT_FOUND') return res.status(404).json({ message: 'User not found' });
    console.error(e);
    res.status(500).json({ message: 'Internal error' });
  }
});

module.exports = { router };
