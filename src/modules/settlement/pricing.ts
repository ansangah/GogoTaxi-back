export function splitCollectPerHead(amount: number, count: number) {
  if (count <= 0) return 0;
  return Math.ceil(amount / count);
}

export function splitRefundPerHead(amount: number, count: number) {
  if (count <= 0) return 0;
  return Math.floor(amount / count);
}
