import { verifyJwt } from '../lib/jwt.ts';
export function requireAuth(req, res, next) {
    const header = req.headers.authorization; // "Bearer <token>"
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: missing Bearer token' });
    }
    const token = header.slice('Bearer '.length);
    try {
        const payload = verifyJwt(token);
        req.user = payload;
        next();
    }
    catch {
        return res.status(401).json({ message: 'Unauthorized: invalid token' });
    }
}
