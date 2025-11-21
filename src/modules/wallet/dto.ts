import { z } from 'zod';

export const TopUpDto = z.object({
  amount: z.number().int().positive(),
  roomId: z.string().cuid().optional(),
  idempotencyKey: z.string().min(6).max(128).optional()
});
export type TopUpDto = z.infer<typeof TopUpDto>;

export const ChargeDto = z.object({
  amount: z.number().int().positive(),
  roomId: z.string().cuid().optional(),
  kind: z.enum([
    'hold_deposit',
    'host_charge',
    'extra_collect',
    'refund',
    'host_refund',
    'adjustment'
  ]).default('hold_deposit'),
  allowNegative: z.boolean().default(false),
  idempotencyKey: z.string().min(6).max(128).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});
export type ChargeDto = z.infer<typeof ChargeDto>;
