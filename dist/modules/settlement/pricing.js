"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitCollectPerHead = splitCollectPerHead;
exports.splitRefundPerHead = splitRefundPerHead;
function splitCollectPerHead(amount, count) {
    if (count <= 0)
        return 0;
    return Math.ceil(amount / count);
}
function splitRefundPerHead(amount, count) {
    if (count <= 0)
        return 0;
    return Math.floor(amount / count);
}
