"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middlewares/auth");
const mockClient_1 = require("./mockClient");
exports.paymentsRouter = (0, express_1.Router)();
exports.paymentsRouter.use(auth_1.requireAuth);
exports.paymentsRouter.get('/mock', (_req, res) => {
    res.json({ payments: (0, mockClient_1.listMockPayments)() });
});
exports.paymentsRouter.post('/mock/charge', (req, res) => {
    try {
        const body = zod_1.z
            .object({
            amount: zod_1.z.number().int().positive(),
            currency: zod_1.z.string().default('KRW'),
            metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
        })
            .parse(req.body);
        const payment = (0, mockClient_1.mockCharge)(body);
        res.status(201).json({ payment });
    }
    catch (e) {
        if (e?.name === 'ZodError')
            return res.status(400).json({ message: 'Validation failed', issues: e.issues });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
exports.paymentsRouter.post('/mock/refund', (req, res) => {
    try {
        const body = zod_1.z
            .object({
            paymentId: zod_1.z.string().uuid(),
            amount: zod_1.z.number().int().positive(),
            currency: zod_1.z.string().default('KRW'),
            metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
        })
            .parse(req.body);
        const payment = (0, mockClient_1.mockRefund)(body);
        res.status(201).json({ payment });
    }
    catch (e) {
        if (e?.name === 'ZodError')
            return res.status(400).json({ message: 'Validation failed', issues: e.issues });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
