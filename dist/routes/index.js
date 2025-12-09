"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const routes_1 = require("../modules/auth/routes");
const auth_1 = require("../middlewares/auth");
const prisma_1 = require("../lib/prisma");
const room_routes_1 = __importDefault(require("./room.routes"));
const ride_routes_1 = __importDefault(require("./ride.routes"));
const routes_2 = require("../modules/payments/routes");
const routes_3 = require("../modules/wallet/routes");
const service_1 = require("../modules/auth/service");
const dto_1 = require("../modules/auth/dto");
const routes_4 = require("../modules/settlement/routes");
const routes_5 = require("../modules/notifications/routes");
const routes_6 = require("../modules/review/routes");
const routes_7 = require("../modules/report/routes");
const routes_8 = require("../modules/rideHistory/routes");
const receiptService_1 = require("../modules/rideHistory/receiptService");
exports.router = (0, express_1.Router)();
exports.router.get('/health', (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
});
exports.router.use('/auth', routes_1.authRouter);
exports.router.use('/payments', routes_2.paymentsRouter);
exports.router.use('/wallet', routes_3.walletRouter);
exports.router.use('/settlements', routes_4.settlementRouter);
exports.router.use(room_routes_1.default);
exports.router.use(ride_routes_1.default);
exports.router.use('/rides', routes_8.rideHistoryRouter);
exports.router.use('/notifications', routes_5.notificationsRouter);
exports.router.use('/reviews', routes_6.reviewRouter);
exports.router.use('/reports', routes_7.reportRouter);
exports.router.post('/receipts/analyze', auth_1.requireAuth, async (req, res) => {
    try {
        const input = zod_1.z
            .object({
            imageBase64: zod_1.z.string().min(20, 'imageBase64 is required'),
            mimeType: zod_1.z.string().optional(),
            prompt: zod_1.z.string().optional()
        })
            .parse(req.body);
        const analysis = await (0, receiptService_1.analyzeReceiptImage)(input);
        res.json({ analysis });
    }
    catch (e) {
        if (e?.name === 'ZodError') {
            return res.status(400).json({ message: 'Validation failed', issues: e.issues });
        }
        if (e?.message === 'GEMINI_API_KEY_NOT_CONFIGURED') {
            return res.status(500).json({ message: 'Gemini API key is not configured.' });
        }
        console.error('receipt analyze error', e);
        const isGeminiUnavailable = typeof e?.message === 'string' &&
            (e.message.includes('GEMINI_FETCH_FAILED') || e.message.includes('GEMINI_REQUEST_FAILED'));
        res.status(isGeminiUnavailable ? 502 : 500).json({
            message: isGeminiUnavailable
                ? 'Gemini Vision 요청이 실패했습니다. 잠시 후 다시 시도해 주세요.'
                : e?.message || 'Failed to analyze receipt'
        });
    }
});
exports.router.get('/me', auth_1.requireAuth, async (req, res) => {
    try {
        const me = await (0, service_1.getProfile)(req.userId);
        res.json({ me });
    }
    catch (e) {
        if (e?.message === 'USER_NOT_FOUND')
            return res.status(404).json({ message: 'User not found' });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
exports.router.patch('/me', auth_1.requireAuth, async (req, res) => {
    try {
        const input = dto_1.UpdateProfileDto.parse(req.body);
        const me = await (0, service_1.updateProfile)(req.userId, input);
        res.json({ me });
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
exports.router.patch('/me/password', auth_1.requireAuth, async (req, res) => {
    try {
        const input = dto_1.ChangePasswordDto.parse(req.body);
        await (0, service_1.changePassword)(req.userId, input);
        res.json({ success: true });
    }
    catch (e) {
        if (e?.name === 'ZodError')
            return res.status(400).json({ message: 'Validation failed', issues: e.issues });
        if (e?.message === 'INVALID_CURRENT_PASSWORD')
            return res.status(401).json({ message: 'Current password is incorrect' });
        if (e?.message === 'PASSWORD_NOT_SET')
            return res.status(400).json({ message: 'Password not set for this account' });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
exports.router.get('/notifications', auth_1.requireAuth, async (_req, res) => {
    try {
        const notifications = await prisma_1.prisma.notice.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        return res.json({ notifications });
    }
    catch (error) {
        console.error('notifications error', error);
        return res.status(500).json({ message: 'Failed to load notifications' });
    }
});
