"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.holdEstimatedFare = holdEstimatedFare;
exports.finalizeRoomSettlement = finalizeRoomSettlement;
const prisma_1 = require("../../lib/prisma");
const service_1 = require("../wallet/service");
const pricing_1 = require("./pricing");
const client_1 = require("@prisma/client");
const service_2 = require("../notifications/service");
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
    const memberIds = Array.from(new Set([room.creatorId, ...room.participants.map((p) => p.userId)]));
    const perHead = (0, pricing_1.splitCollectPerHead)(room.estimatedFare, memberIds.length);
    for (const userId of memberIds) {
        const isHost = userId === room.creatorId;
        await (0, service_1.ensureBalanceForDebit)(userId, perHead, { roomId, reason: 'hold' });
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
        (0, service_2.sendNotification)({
            userId,
            title: `방 "${room.title}" 예치금 차감`,
            body: `${perHead.toLocaleString()}원이 예치금으로 차감되었습니다.`,
            metadata: { roomId }
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
    const memberIds = Array.from(new Set([room.creatorId, ...room.participants.map((p) => p.userId)]));
    const noShow = new Set(room.noShowUserIds ?? []);
    const delta = actualFare - room.estimatedFare;
    const activeForExtra = memberIds.filter((id) => !noShow.has(id));
    let extraPerHead = 0;
    let refundPerHead = 0;
    if (delta > 0 && activeForExtra.length > 0) {
        extraPerHead = (0, pricing_1.splitCollectPerHead)(delta, activeForExtra.length);
        for (const userId of activeForExtra) {
            const isHost = userId === room.creatorId;
            await (0, service_1.ensureBalanceForDebit)(userId, extraPerHead, { roomId, reason: 'extra' });
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
            settlementStatus: 'settled',
            status: 'closed'
        }
    });
    const settledAt = new Date();
    const settlementRecords = await prisma_1.prisma.roomSettlement.findMany({
        where: { roomId },
        select: {
            userId: true,
            role: true,
            deposit: true,
            extraCollect: true,
            refund: true,
            netAmount: true
        }
    });
    await prisma_1.prisma.$transaction(async (tx) => {
        const rideHistoryDelegate = tx?.rideHistory;
        if (!rideHistoryDelegate || typeof rideHistoryDelegate.upsert !== 'function') {
            console.warn('rideHistory delegate is unavailable; skipping history upsert.');
        }
        else {
            for (const record of settlementRecords) {
                const payload = {
                    role: record.role,
                    deposit: record.deposit,
                    extraCollect: record.extraCollect,
                    refund: record.refund,
                    netAmount: record.netAmount,
                    actualFare,
                    settledAt
                };
                await rideHistoryDelegate.upsert({
                    where: { roomId_userId: { roomId, userId: record.userId } },
                    update: payload,
                    create: {
                        roomId,
                        userId: record.userId,
                        ...payload
                    }
                });
            }
        }
        await tx.roomParticipant.deleteMany({ where: { roomId } });
    });
    const summary = delta === 0
        ? '추가 정산 금액 없이 종료되었습니다.'
        : delta > 0
            ? `예상보다 ${delta.toLocaleString()}원 더 나와 추가 징수되었습니다.`
            : `예상보다 ${Math.abs(delta).toLocaleString()}원 적게 나와 환급되었습니다.`;
    for (const userId of memberIds) {
        (0, service_2.sendNotification)({
            userId,
            title: `방 "${room.title}" 정산 완료`,
            body: `실요금 ${actualFare.toLocaleString()}원으로 정산되었습니다. ${summary}`,
            metadata: { roomId, delta }
        });
    }
    return { delta, extraPerHead, refundPerHead };
}
