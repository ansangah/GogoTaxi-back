"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBalance = getBalance;
exports.recordTransaction = recordTransaction;
exports.ensureBalanceForDebit = ensureBalanceForDebit;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../lib/prisma");
const mockClient_1 = require("../payments/mockClient");
async function getBalance(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true }
    });
    if (!user)
        throw new Error('USER_NOT_FOUND');
    return user.walletBalance;
}
async function recordTransaction(input) {
    return prisma_1.prisma.$transaction(async (tx) => {
        if (input.idempotencyKey) {
            const dup = await tx.walletTransaction.findUnique({
                where: { idempotencyKey: input.idempotencyKey }
            });
            if (dup)
                return dup;
        }
        const user = await tx.user.findUnique({
            where: { id: input.userId },
            select: { walletBalance: true }
        });
        if (!user)
            throw new Error('USER_NOT_FOUND');
        const nextBalance = user.walletBalance + input.amount;
        if (!input.allowNegative && nextBalance < 0) {
            throw new Error('INSUFFICIENT_BALANCE');
        }
        const txRecord = await tx.walletTransaction.create({
            data: {
                userId: input.userId,
                roomId: input.roomId,
                kind: input.kind,
                amount: input.amount,
                status: input.status ?? client_1.WalletTxStatus.success,
                currency: input.currency ?? 'KRW',
                metadata: input.metadata,
                idempotencyKey: input.idempotencyKey
            }
        });
        await tx.user.update({
            where: { id: input.userId },
            data: { walletBalance: nextBalance }
        });
        return txRecord;
    });
}
async function ensureBalanceForDebit(userId, amount, opts) {
    const current = await getBalance(userId);
    if (current >= amount) {
        return { autoTopUp: false, deficit: 0 };
    }
    const deficit = amount - current;
    const payment = (0, mockClient_1.mockCharge)({
        amount: deficit,
        currency: 'KRW',
        metadata: { userId, roomId: opts?.roomId, reason: opts?.reason }
    });
    await recordTransaction({
        userId,
        roomId: opts?.roomId,
        kind: client_1.WalletTxKind.auto_top_up,
        amount: deficit,
        idempotencyKey: `auto_top_up:${opts?.reason ?? 'debit'}:${opts?.roomId ?? 'general'}:${userId}:${payment.id}`
    });
    return { autoTopUp: true, deficit, payment };
}
