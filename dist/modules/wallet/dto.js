"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChargeDto = exports.TopUpDto = void 0;
const zod_1 = require("zod");
exports.TopUpDto = zod_1.z.object({
    amount: zod_1.z.number().int().positive(),
    roomId: zod_1.z.string().cuid().optional(),
    idempotencyKey: zod_1.z.string().min(6).max(128).optional()
});
exports.ChargeDto = zod_1.z.object({
    amount: zod_1.z.number().int().positive(),
    roomId: zod_1.z.string().cuid().optional(),
    kind: zod_1.z.enum([
        'hold_deposit',
        'host_charge',
        'extra_collect',
        'refund',
        'host_refund',
        'adjustment'
    ]).default('hold_deposit'),
    allowNegative: zod_1.z.boolean().default(false),
    idempotencyKey: zod_1.z.string().min(6).max(128).optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
});
