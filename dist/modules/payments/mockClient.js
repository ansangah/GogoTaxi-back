"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockCharge = mockCharge;
exports.mockRefund = mockRefund;
exports.listMockPayments = listMockPayments;
const crypto_1 = require("crypto");
const payments = [];
function mockCharge(input) {
    const payment = {
        id: (0, crypto_1.randomUUID)(),
        type: 'charge',
        amount: input.amount,
        currency: input.currency ?? 'KRW',
        status: 'succeeded',
        createdAt: new Date().toISOString(),
        metadata: input.metadata
    };
    payments.push(payment);
    return payment;
}
function mockRefund(input) {
    const payment = {
        id: (0, crypto_1.randomUUID)(),
        parentId: input.paymentId,
        type: 'refund',
        amount: input.amount,
        currency: input.currency ?? 'KRW',
        status: 'succeeded',
        createdAt: new Date().toISOString(),
        metadata: input.metadata
    };
    payments.push(payment);
    return payment;
}
function listMockPayments() {
    return [...payments];
}
