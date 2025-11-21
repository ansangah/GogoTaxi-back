import { randomUUID } from 'crypto';

type MockPaymentStatus = 'succeeded' | 'failed';
type MockPaymentType = 'charge' | 'refund';

export type MockPayment = {
  id: string;
  type: MockPaymentType;
  amount: number;
  currency: string;
  status: MockPaymentStatus;
  createdAt: string;
  metadata?: Record<string, unknown>;
  parentId?: string;
};

type MockChargeInput = {
  amount: number;
  currency?: string;
  metadata?: Record<string, unknown>;
};

type MockRefundInput = {
  paymentId: string;
  amount: number;
  currency?: string;
  metadata?: Record<string, unknown>;
};

const payments: MockPayment[] = [];

export function mockCharge(input: MockChargeInput): MockPayment {
  const payment: MockPayment = {
    id: randomUUID(),
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

export function mockRefund(input: MockRefundInput): MockPayment {
  const payment: MockPayment = {
    id: randomUUID(),
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

export function listMockPayments() {
  return [...payments];
}
