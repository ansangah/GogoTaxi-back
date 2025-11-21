"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const dto_1 = require("./dto");
const service_1 = require("./service");
const client_1 = require("@prisma/client");
exports.walletRouter = (0, express_1.Router)();
exports.walletRouter.use(auth_1.requireAuth);
exports.walletRouter.get('/balance', async (req, res) => {
    try {
        const balance = await (0, service_1.getBalance)(req.user.sub);
        res.json({ balance });
    }
    catch (e) {
        if (e?.message === 'USER_NOT_FOUND')
            return res.status(404).json({ message: 'User not found' });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
exports.walletRouter.post('/topup', async (req, res) => {
    try {
        const input = dto_1.TopUpDto.parse(req.body);
        const tx = await (0, service_1.recordTransaction)({
            userId: req.user.sub,
            roomId: input.roomId,
            kind: client_1.WalletTxKind.top_up,
            amount: input.amount,
            idempotencyKey: input.idempotencyKey
        });
        res.status(201).json({ transaction: tx });
    }
    catch (e) {
        if (e?.name === 'ZodError')
            return res.status(400).json({ message: 'Validation failed', issues: e.issues });
        if (e?.message === 'USER_NOT_FOUND')
            return res.status(404).json({ message: 'User not found' });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
exports.walletRouter.post('/charge', async (req, res) => {
    try {
        const input = dto_1.ChargeDto.parse(req.body);
        const sign = input.kind === 'refund' || input.kind === 'host_refund' ? 1 : -1;
        const tx = await (0, service_1.recordTransaction)({
            userId: req.user.sub,
            roomId: input.roomId,
            kind: input.kind,
            amount: sign * input.amount,
            idempotencyKey: input.idempotencyKey,
            allowNegative: input.allowNegative,
            metadata: input.metadata
        });
        res.status(201).json({ transaction: tx });
    }
    catch (e) {
        if (e?.name === 'ZodError')
            return res.status(400).json({ message: 'Validation failed', issues: e.issues });
        if (e?.message === 'USER_NOT_FOUND')
            return res.status(404).json({ message: 'User not found' });
        if (e?.message === 'INSUFFICIENT_BALANCE')
            return res.status(402).json({ message: 'Insufficient balance' });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
