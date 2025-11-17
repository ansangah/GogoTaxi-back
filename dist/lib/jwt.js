import jwt from 'jsonwebtoken';
const SECRET = (process.env.JWT_SECRET ?? 'dev');
const RAW = process.env.JWT_EXPIRES_IN ?? '7d';
const EXPIRES_IN = /^\d+$/.test(RAW) ? Number(RAW) : RAW ?? '7d';
export function signJwt(payload) {
    const opts = { expiresIn: EXPIRES_IN };
    return jwt.sign(payload, SECRET, opts);
}
export function verifyJwt(token) {
    return jwt.verify(token, SECRET);
}
