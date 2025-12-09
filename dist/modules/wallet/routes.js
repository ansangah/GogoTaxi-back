"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const dto_1 = require("./dto");
const service_1 = require("./service");
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("multer"));
const gemini_1 = require("../payments/gemini");
exports.walletRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});
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
        if (e?.message === 'ROOM_NOT_FOUND')
            return res.status(404).json({ message: 'Room not found' });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
exports.walletRouter.post('/charge', async (req, res) => {
    try {
        const input = dto_1.ChargeDto.parse(req.body);
        const sign = input.kind === 'refund' || input.kind === 'host_refund' ? 1 : -1;
        if (sign === -1 && !input.allowNegative) {
            await (0, service_1.ensureBalanceForDebit)(req.user.sub, input.amount, {
                roomId: input.roomId,
                reason: input.kind
            });
        }
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
        if (e?.message === 'ROOM_NOT_FOUND')
            return res.status(404).json({ message: 'Room not found' });
        if (e?.message === 'INSUFFICIENT_BALANCE')
            return res.status(402).json({ message: 'Insufficient balance' });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
exports.walletRouter.post('/receipt/amount', upload.single('image'), async (req, res) => {
    try {
        const imageBase64 = req.file?.buffer?.toString('base64') ?? (typeof req.body.imageBase64 === 'string' ? req.body.imageBase64 : null);
        const mimeType = req.file?.mimetype ?? (typeof req.body.mimeType === 'string' ? req.body.mimeType : undefined);
        console.log('receipt/amount request', {
            hasFile: !!req.file,
            fileSize: req.file?.size,
            mimeType,
            hasBase64Field: typeof req.body.imageBase64 === 'string'
        });
        if (!imageBase64) {
            return res.status(400).json({ message: 'imageBase64 or image file is required' });
        }
        const result = await (0, gemini_1.extractAmountFromImage)(imageBase64, mimeType);
        if (result.amount == null) {
            console.warn('Receipt OCR failed', { reason: result.reason, rawText: result.rawText?.slice(0, 200) });
            return res.status(422).json({
                message: 'Failed to recognize amount from image',
                reason: result.reason,
                rawText: result.rawText
            });
        }
        const amount = Math.round(result.amount);
        const { autoTopUp, deficit, payment } = await (0, service_1.ensureBalanceForDebit)(req.user.sub, amount, {
            reason: 'receipt_upload'
        });
        return res.json({
            amount,
            autoTopUp,
            deficit,
            payment,
            rawText: result.rawText
        });
    }
    catch (e) {
        if (e?.name === 'ZodError') {
            return res.status(400).json({ message: 'Validation failed', issues: e.issues });
        }
        if (e?.message === 'USER_NOT_FOUND') {
            return res.status(404).json({ message: 'User not found' });
        }
        if (e?.message === 'INSUFFICIENT_BALANCE') {
            return res.status(402).json({ message: 'Insufficient balance' });
        }
        console.error('receipt/amount error', e);
        return res.status(500).json({ message: 'Failed to process receipt amount', error: e?.message ?? 'unknown' });
    }
});
