import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth';
import { listMockPayments, mockCharge, mockRefund } from './mockClient';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

paymentsRouter.get('/mock', (_req, res) => {
  res.json({ payments: listMockPayments() });
});

paymentsRouter.post('/mock/charge', (req, res) => {
  try {
    const body = z
      .object({
        amount: z.number().int().positive(),
        currency: z.string().default('KRW'),
        metadata: z.record(z.string(), z.any()).optional()
      })
      .parse(req.body);
    const payment = mockCharge(body);
    res.status(201).json({ payment });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ message: 'Validation failed', issues: e.issues });
    console.error(e);
    res.status(500).json({ message: 'Internal error' });
  }
});

paymentsRouter.post('/mock/refund', (req, res) => {
  try {
    const body = z
      .object({
        paymentId: z.string().uuid(),
        amount: z.number().int().positive(),
        currency: z.string().default('KRW'),
        metadata: z.record(z.string(), z.any()).optional()
      })
      .parse(req.body);
    const payment = mockRefund(body);
    res.status(201).json({ payment });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ message: 'Validation failed', issues: e.issues });
    console.error(e);
    res.status(500).json({ message: 'Internal error' });
  }
});
