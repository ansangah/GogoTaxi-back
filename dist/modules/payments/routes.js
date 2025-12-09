"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middlewares/auth");
const mockClient_1 = require("./mockClient");
const service_1 = require("./service");
const gemini_1 = require("./gemini");
const service_2 = require("../wallet/service");
const prisma_1 = require("../../lib/prisma");
const MOCK_WEBHOOK_SECRET = process.env.PAYMENTS_MOCK_WEBHOOK_SECRET ?? 'mock-secret';
exports.paymentsRouter = (0, express_1.Router)();
const normalizeLocation = (value) => {
    if (!value)
        return '';
    return value
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\s.,/\\'"`|()[\]-]/g, '')
        .trim();
};
const isLocationMatch = (expected, actual) => {
    const normalizedExpected = normalizeLocation(expected);
    const normalizedActual = normalizeLocation(actual);
    if (!normalizedExpected || !normalizedActual)
        return false;
    return (normalizedExpected === normalizedActual ||
        normalizedExpected.includes(normalizedActual) ||
        normalizedActual.includes(normalizedExpected));
};
exports.paymentsRouter.post('/mock/webhook', async (req, res) => {
    try {
        const body = zod_1.z
            .object({
            sessionId: zod_1.z.string().uuid(),
            event: zod_1.z.enum(['payment.succeeded', 'payment.failed']),
            secret: zod_1.z.string().min(3)
        })
            .parse(req.body);
        if (body.secret !== MOCK_WEBHOOK_SECRET) {
            return res.status(401).json({ message: 'Invalid secret' });
        }
        const session = await (0, service_1.processPaymentEvent)(body.sessionId, body.event);
        res.json({ session });
    }
    catch (e) {
        if (e?.name === 'ZodError')
            return res.status(400).json({ message: 'Validation failed', issues: e.issues });
        if (e?.message === 'SESSION_NOT_FOUND')
            return res.status(404).json({ message: 'Session not found' });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
exports.paymentsRouter.use(auth_1.requireAuth);
exports.paymentsRouter.get('/mock', (_req, res) => {
    res.json({ payments: (0, mockClient_1.listMockPayments)() });
});
exports.paymentsRouter.post('/ocr/estimate', async (req, res) => {
    try {
        const body = zod_1.z
            .object({
            imageBase64: zod_1.z.string().min(10),
            mimeType: zod_1.z.string().min(3).optional(),
            roomId: zod_1.z.string().cuid().optional(),
            model: zod_1.z.string().min(3).optional(),
            apiVersion: zod_1.z.string().min(2).optional()
        })
            .parse(req.body);
        const room = body.roomId &&
            (await prisma_1.prisma.room.findUnique({
                where: { id: body.roomId },
                select: { id: true, departureLabel: true, arrivalLabel: true }
            }));
        if (body.roomId && !room) {
            return res.status(404).json({ message: 'Room not found' });
        }
        const result = await (0, gemini_1.extractAmountFromImage)(body.imageBase64, body.mimeType, body.model, body.apiVersion);
        if (result.amount == null) {
            console.warn('OCR amount failed', { reason: result.reason, rawText: result.rawText?.slice(0, 200) });
            return res.status(422).json({
                message: 'Failed to recognize amount from image',
                reason: result.reason,
                rawText: result.rawText
            });
        }
        if (room) {
            const pickupMatch = isLocationMatch(room.departureLabel, result.pickup ?? null);
            const dropoffMatch = isLocationMatch(room.arrivalLabel, result.dropoff ?? null);
            if (!pickupMatch || !dropoffMatch) {
                return res.status(409).json({
                    message: '우버 캡처의 출발/도착지가 방 설정과 일치하지 않습니다. 다시 확인하고 첨부해 주세요.',
                    reason: 'ADDRESS_MISMATCH',
                    expected: { pickup: room.departureLabel, dropoff: room.arrivalLabel },
                    detected: { pickup: result.pickup ?? null, dropoff: result.dropoff ?? null },
                    rawText: result.rawText
                });
            }
        }
        const amount = Math.round(result.amount);
        const { autoTopUp, deficit, payment } = await (0, service_2.ensureBalanceForDebit)(req.user.sub, amount, {
            roomId: body.roomId,
            reason: 'image_estimate'
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
        console.error(e);
        return res.status(500).json({ message: 'Failed to process image payment estimate' });
    }
});
exports.paymentsRouter.get('/mock/sessions', (req, res) => {
    const sessions = (0, service_1.listPaymentSessions)(req.user?.sub);
    res.json({ sessions });
});
exports.paymentsRouter.post('/mock/session', async (req, res) => {
    try {
        const body = zod_1.z
            .object({
            amount: zod_1.z.number().int().positive(),
            currency: zod_1.z.string().default('KRW'),
            purpose: zod_1.z.enum(['wallet_topup', 'room_charge']),
            roomId: zod_1.z.string().cuid().optional(),
            metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
        })
            .parse(req.body);
        const session = (0, service_1.createPaymentSession)({
            userId: req.user.sub,
            amount: body.amount,
            currency: body.currency,
            purpose: body.purpose,
            roomId: body.roomId,
            metadata: body.metadata
        });
        res.status(201).json({
            session,
            paymentUrl: `https://mock.payments.local/session/${session.id}`
        });
    }
    catch (e) {
        if (e?.name === 'ZodError')
            return res.status(400).json({ message: 'Validation failed', issues: e.issues });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
exports.paymentsRouter.post('/mock/session/:sessionId/confirm', async (req, res) => {
    try {
        const params = zod_1.z.object({ sessionId: zod_1.z.string().uuid() }).parse(req.params);
        const session = await (0, service_1.processPaymentEvent)(params.sessionId, 'payment.succeeded');
        res.json({ session });
    }
    catch (e) {
        if (e?.name === 'ZodError')
            return res.status(400).json({ message: 'Validation failed', issues: e.issues });
        if (e?.message === 'SESSION_NOT_FOUND')
            return res.status(404).json({ message: 'Session not found' });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
exports.paymentsRouter.post('/mock/session/:sessionId/fail', async (req, res) => {
    try {
        const params = zod_1.z.object({ sessionId: zod_1.z.string().uuid() }).parse(req.params);
        const session = await (0, service_1.processPaymentEvent)(params.sessionId, 'payment.failed');
        res.json({ session });
    }
    catch (e) {
        if (e?.name === 'ZodError')
            return res.status(400).json({ message: 'Validation failed', issues: e.issues });
        if (e?.message === 'SESSION_NOT_FOUND')
            return res.status(404).json({ message: 'Session not found' });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
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
