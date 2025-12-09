"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRideHistory = listRideHistory;
const prisma_1 = require("../../lib/prisma");
async function listRideHistory(userId) {
    const delegate = prisma_1.prisma?.rideHistory;
    if (!delegate) {
        console.warn('rideHistory delegate unavailable; returning empty history.');
        return [];
    }
    return delegate.findMany({
        where: { userId },
        include: {
            room: {
                select: {
                    id: true,
                    title: true,
                    departureLabel: true,
                    arrivalLabel: true,
                    departureTime: true
                }
            }
        },
        orderBy: { settledAt: 'desc' }
    });
}
