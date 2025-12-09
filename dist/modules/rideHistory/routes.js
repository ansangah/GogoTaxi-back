"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rideHistoryRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const service_1 = require("./service");
exports.rideHistoryRouter = (0, express_1.Router)();
exports.rideHistoryRouter.use(auth_1.requireAuth);
exports.rideHistoryRouter.get('/history', async (req, res) => {
    try {
        const histories = await (0, service_1.listRideHistory)(req.user.sub);
        res.json({ histories });
    }
    catch (e) {
        console.error('ride history error', e);
        res.status(500).json({ message: 'Failed to load ride history' });
    }
});
