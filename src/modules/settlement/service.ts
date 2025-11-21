import { prisma } from '../../lib/prisma';
import { ensureBalanceForDebit, recordTransaction } from '../wallet/service';
import { splitCollectPerHead, splitRefundPerHead } from './pricing';
import { SettlementRecordStatus, SettlementRole, WalletTxKind } from '@prisma/client';

const idKey = (roomId: string, phase: string, userId: string) => `room:${roomId}:${phase}:${userId}`;

async function upsertSettlement(params: {
  roomId: string;
  userId: string;
  role: SettlementRole;
  deposit?: number;
  extraCollect?: number;
  refund?: number;
  netAmount?: number;
  noShow?: boolean;
  status?: SettlementRecordStatus;
}) {
  const { roomId, userId, role, ...data } = params;
  await prisma.roomSettlement.upsert({
    where: { roomId_userId: { roomId, userId } },
    update: { role, ...data },
    create: { roomId, userId, role, ...data }
  });
}

export async function holdEstimatedFare(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { participants: true, creator: true }
  });
  if (!room) throw new Error('ROOM_NOT_FOUND');
  if (room.estimatedFare == null) throw new Error('ESTIMATED_FARE_MISSING');

  const memberIds = [room.creatorId, ...room.participants.map((p) => p.userId)];
  const perHead = splitCollectPerHead(room.estimatedFare, memberIds.length);

  for (const userId of memberIds) {
    const isHost = userId === room.creatorId;
    if (isHost) {
      await ensureBalanceForDebit(userId, perHead, { roomId, reason: 'hold' });
    }
    const kind = isHost ? WalletTxKind.host_charge : WalletTxKind.hold_deposit;
    await recordTransaction({
      userId,
      roomId,
      kind,
      amount: -perHead,
      idempotencyKey: idKey(roomId, 'hold', userId)
    });
    await upsertSettlement({
      roomId,
      userId,
      role: userId === room.creatorId ? SettlementRole.host : SettlementRole.guest,
      deposit: perHead,
      netAmount: perHead,
      status: SettlementRecordStatus.pending
    });
  }

  await prisma.room.update({
    where: { id: roomId },
    data: { settlementStatus: 'deposit_collected' }
  });

  return { perHead, collectedFrom: memberIds.length };
}

export async function finalizeRoomSettlement(roomId: string, actualFare: number) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      participants: true,
      creator: true
    }
  });
  if (!room) throw new Error('ROOM_NOT_FOUND');
  if (room.estimatedFare == null) throw new Error('ESTIMATED_FARE_MISSING');

  const memberIds = [room.creatorId, ...room.participants.map((p) => p.userId)];
  const noShow = new Set(room.noShowUserIds ?? []);

  const delta = actualFare - room.estimatedFare;
  const activeForExtra = memberIds.filter((id) => !noShow.has(id));

  let extraPerHead = 0;
  let refundPerHead = 0;

  if (delta > 0 && activeForExtra.length > 0) {
    extraPerHead = splitCollectPerHead(delta, activeForExtra.length);
    for (const userId of activeForExtra) {
      const isHost = userId === room.creatorId;
      if (isHost) {
        await ensureBalanceForDebit(userId, extraPerHead, { roomId, reason: 'extra' });
      }
      await recordTransaction({
        userId,
        roomId,
        kind: WalletTxKind.extra_collect,
        amount: -extraPerHead,
        idempotencyKey: idKey(roomId, 'extra', userId)
      });
      await upsertSettlement({
        roomId,
        userId,
        role: userId === room.creatorId ? SettlementRole.host : SettlementRole.guest,
        extraCollect: extraPerHead,
        netAmount: extraPerHead
      });
    }
  }

  if (delta < 0 && memberIds.length > 0) {
    refundPerHead = splitRefundPerHead(Math.abs(delta), memberIds.length);
    for (const userId of memberIds) {
      await recordTransaction({
        userId,
        roomId,
        kind: WalletTxKind.refund,
        amount: refundPerHead,
        idempotencyKey: idKey(roomId, 'refund', userId)
      });
      await upsertSettlement({
        roomId,
        userId,
        role: userId === room.creatorId ? SettlementRole.host : SettlementRole.guest,
        refund: refundPerHead,
        netAmount: -refundPerHead,
        noShow: noShow.has(userId),
        status: SettlementRecordStatus.settled
      });
    }
  }

  await prisma.room.update({
    where: { id: roomId },
    data: {
      actualFare,
      settlementStatus: 'settled'
    }
  });

  return { delta, extraPerHead, refundPerHead };
}
