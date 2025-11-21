"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middlewares/auth");
const service_1 = require("./service");
exports.settlementRouter = (0, express_1.Router)();
exports.settlementRouter.use(auth_1.requireAuth);
exports.settlementRouter.post('/rooms/:roomId/hold', async (req, res) => {
    try {
        const roomId = zod_1.z.string().cuid().parse(req.params.roomId);
        const result = await (0, service_1.holdEstimatedFare)(roomId);
        res.status(201).json(result);
    }
    catch (e) {
        if (e?.name === 'ZodError')
            return res.status(400).json({ message: 'Validation failed', issues: e.issues });
        if (e?.message === 'ROOM_NOT_FOUND')
            return res.status(404).json({ message: 'Room not found' });
        if (e?.message === 'ESTIMATED_FARE_MISSING')
            return res.status(409).json({ message: 'Estimated fare required' });
        if (e?.message === 'INSUFFICIENT_BALANCE')
            return res.status(402).json({ message: 'Insufficient balance' });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
exports.settlementRouter.post('/rooms/:roomId/finalize', async (req, res) => {
    try {
        const roomId = zod_1.z.string().cuid().parse(req.params.roomId);
        const body = zod_1.z.object({ actualFare: zod_1.z.number().int().positive() }).parse(req.body);
        const result = await (0, service_1.finalizeRoomSettlement)(roomId, body.actualFare);
        res.status(201).json(result);
    }
    catch (e) {
        if (e?.name === 'ZodError')
            return res.status(400).json({ message: 'Validation failed', issues: e.issues });
        if (e?.message === 'ROOM_NOT_FOUND')
            return res.status(404).json({ message: 'Room not found' });
        if (e?.message === 'ESTIMATED_FARE_MISSING')
            return res.status(409).json({ message: 'Estimated fare required' });
        console.error(e);
        res.status(500).json({ message: 'Internal error' });
    }
});
