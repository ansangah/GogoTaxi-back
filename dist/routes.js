"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const routes_1 = require("./modules/auth/routes");
const auth_1 = require("./middlewares/auth");
const service_1 = require("./modules/auth/service");
const dto_1 = require("./modules/auth/dto");
exports.router = (0, express_1.Router)();
// 상태 확인
exports.router.get('/', (_req, res) => res.json({ message: 'GogoTaxi backend up' }));
// 인증 관련
exports.router.use('/auth', routes_1.authRouter);
// 보호 API
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
module.exports = { router: exports.router };
