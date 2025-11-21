"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.holdEstimatedFare = holdEstimatedFare;
exports.finalizeRoomSettlement = finalizeRoomSettlement;
const prisma_1 = require("../../lib/prisma");
const service_1 = require("../wallet/service");
const pricing_1 = require("./pricing");
const client_1 = require("@prisma/client");
const idKey = (roomId, phase, userId) => `room:${roomId}:${phase}:${userId}`;
async function upsertSettlement(params) {
    const { roomId, userId, role, ...data } = params;
    await prisma_1.prisma.roomSettlement.upsert({
        where: { roomId_userId: { roomId, userId } },
        update: { role, ...data },
        create: { roomId, userId, role, ...data }
    });
}
async function holdEstimatedFare(roomId) {
    const room = await prisma_1.prisma.room.findUnique({
        where: { id: roomId },
        include: { participants: true, creator: true }
    });
    if (!room)
        throw new Error('ROOM_NOT_FOUND');
    if (room.estimatedFare == null)
        throw new Error('ESTIMATED_FARE_MISSING');
    const memberIds = [room.creatorId, ...room.participants.map((p) => p.userId)];
    const perHead = (0, pricing_1.splitCollectPerHead)(room.estimatedFare, memberIds.length);
    for (const userId of memberIds) {
        const isHost = userId === room.creatorId;
        if (isHost) {
            await (0, service_1.ensureBalanceForDebit)(userId, perHead, { roomId, reason: 'hold' });
        }
        const kind = isHost ? client_1.WalletTxKind.host_charge : client_1.WalletTxKind.hold_deposit;
        await (0, service_1.recordTransaction)({
            userId,
            roomId,
            kind,
            amount: -perHead,
            idempotencyKey: idKey(roomId, 'hold', userId)
        });
        await upsertSettlement({
            roomId,
            userId,
            role: userId === room.creatorId ? client_1.SettlementRole.host : client_1.SettlementRole.guest,
            deposit: perHead,
            netAmount: perHead,
            status: client_1.SettlementRecordStatus.pending
        });
    }
    await prisma_1.prisma.room.update({
        where: { id: roomId },
        data: { settlementStatus: 'deposit_collected' }
    });
    return { perHead, collectedFrom: memberIds.length };
}
async function finalizeRoomSettlement(roomId, actualFare) {
    const room = await prisma_1.prisma.room.findUnique({
        where: { id: roomId },
        include: {
            participants: true,
            creator: true
        }
    });
    if (!room)
        throw new Error('ROOM_NOT_FOUND');
    if (room.estimatedFare == null)
        throw new Error('ESTIMATED_FARE_MISSING');
    const memberIds = [room.creatorId, ...room.participants.map((p) => p.userId)];
    const noShow = new Set(room.noShowUserIds ?? []);
    const delta = actualFare - room.estimatedFare;
    const activeForExtra = memberIds.filter((id) => !noShow.has(id));
    let extraPerHead = 0;
    let refundPerHead = 0;
    if (delta > 0 && activeForExtra.length > 0) {
        extraPerHead = (0, pricing_1.splitCollectPerHead)(delta, activeForExtra.length);
        for (const userId of activeForExtra) {
            const isHost = userId === room.creatorId;
            if (isHost) {
                await (0, service_1.ensureBalanceForDebit)(userId, extraPerHead, { roomId, reason: 'extra' });
            }
            await (0, service_1.recordTransaction)({
                userId,
                roomId,
                kind: client_1.WalletTxKind.extra_collect,
                amount: -extraPerHead,
                idempotencyKey: idKey(roomId, 'extra', userId)
            });
            await upsertSettlement({
                roomId,
                userId,
                role: userId === room.creatorId ? client_1.SettlementRole.host : client_1.SettlementRole.guest,
                extraCollect: extraPerHead,
                netAmount: extraPerHead
            });
        }
    }
    if (delta < 0 && memberIds.length > 0) {
        refundPerHead = (0, pricing_1.splitRefundPerHead)(Math.abs(delta), memberIds.length);
        for (const userId of memberIds) {
            await (0, service_1.recordTransaction)({
                userId,
                roomId,
                kind: client_1.WalletTxKind.refund,
                amount: refundPerHead,
                idempotencyKey: idKey(roomId, 'refund', userId)
            });
            await upsertSettlement({
                roomId,
                userId,
                role: userId === room.creatorId ? client_1.SettlementRole.host : client_1.SettlementRole.guest,
                refund: refundPerHead,
                netAmount: -refundPerHead,
                noShow: noShow.has(userId),
                status: client_1.SettlementRecordStatus.settled
            });
        }
    }
    await prisma_1.prisma.room.update({
        where: { id: roomId },
        data: {
            actualFare,
            settlementStatus: 'settled'
        }
    });
    return { delta, extraPerHead, refundPerHead };
}
