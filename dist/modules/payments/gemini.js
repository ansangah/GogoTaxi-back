"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAmountFromImage = extractAmountFromImage;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../../config/env");
const defaultApiVersion = env_1.ENV.GEMINI_API_VERSION || 'v1';
const defaultModel = env_1.ENV.GEMINI_MODEL || 'gemini-2.0-flash-001';
function buildGeminiUrl(modelOverride, versionOverride) {
    const rawModel = (modelOverride && modelOverride.trim()) || defaultModel;
    const normalizedModel = rawModel.replace(/^models\//, ''); // allow both "gemini-..." and "models/gemini-..."
    const version = (versionOverride && versionOverride.trim()) || defaultApiVersion;
    return `https://generativelanguage.googleapis.com/${version}/models/${normalizedModel}:generateContent`;
}
function parseLocations(text) {
    const trimmed = text.trim();
    if (!trimmed)
        return {};
    // Prefer structured JSON if the model follows the instruction.
    try {
        const parsed = JSON.parse(trimmed);
        const pickup = typeof parsed.pickup === 'string' ? parsed.pickup.trim() : undefined;
        const dropoff = typeof parsed.dropoff === 'string' ? parsed.dropoff.trim() : undefined;
        return { pickup, dropoff };
    }
    catch {
        // fallthrough
    }
    // Lightweight heuristic extraction when JSON is not returned.
    const pickupMatch = text.match(/(?:pickup|\uCD9C\uBC1C)\s*[:\-]?\s*([^\n|]+)/i);
    const dropoffMatch = text.match(/(?:dropoff|destination|to|\uB3C4\uCC29)\s*[:\-]?\s*([^\n|]+)/i);
    return {
        pickup: pickupMatch?.[1]?.trim(),
        dropoff: dropoffMatch?.[1]?.trim()
    };
}
async function extractAmountFromImage(imageBase64, mimeType = 'image/png', modelOverride, apiVersionOverride) {
    if (!env_1.ENV.GEMINI_API_KEY) {
        return { amount: null, rawText: '', reason: 'GEMINI_API_KEY not configured' };
    }
    // Strip data URL prefix if present.
    const normalizedBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '').trim();
    const prompt = [
        'Uber 캡처 화면에서 "일반 택시" 요금 범위의 최댓값(정수)만 amount에 넣으세요.',
        '예: "₩6,300-7,800"이라면 7800만 반환하세요.',
        '스피드호출/우티/타 서비스 가격은 모두 무시하세요.',
        '출발지/도착지 텍스트를 pickup/dropoff에 넣고 JSON 한 줄로만 답변하세요.',
        '형식: {"amount":"7800","pickup":"강남역","dropoff":"서울역"}',
        '통화 기호/단위/콤마 제거, 값이 없으면 null을 넣으세요.'
    ].join(' ');
    const pickMaxAmount = (text) => {
        const cleaned = text
            .replace(/[,\s\u00A0]/g, '') // commas, spaces, non-breaking space
            .replace(/[\uC6D0\u20A9]|KRW/gi, ''); // currency markers (원, ₩, KRW)
        const range = cleaned.match(/(\d+(?:\.\d+)?)[~-](\d+(?:\.\d+)?)/);
        if (range) {
            return Number(range[2]);
        }
        const nums = [...cleaned.matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0])).filter(n => !Number.isNaN(n));
        if (nums.length === 0)
            return null;
        return Math.max(...nums);
    };
    const attempts = [];
    const primary = { model: modelOverride, version: apiVersionOverride };
    const fallbacks = [
        { model: 'gemini-2.5-flash', version: 'v1' },
        { model: 'gemini-2.0-flash-001', version: 'v1' },
        { model: 'gemini-2.0-flash', version: 'v1' },
        { model: 'gemini-2.5-flash-lite', version: 'v1' },
        { model: 'gemini-2.0-flash-lite-001', version: 'v1' }
    ];
    const candidates = [primary, ...fallbacks].map(c => ({
        model: (c.model && c.model.trim()) || defaultModel,
        version: (c.version && c.version.trim()) || defaultApiVersion
    }));
    const errors = [];
    for (const c of candidates) {
        const url = `${buildGeminiUrl(c.model, c.version)}?key=${env_1.ENV.GEMINI_API_KEY}`;
        attempts.push(c);
        try {
            const { data } = await axios_1.default.post(url, {
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data: normalizedBase64 } }
                        ]
                    }
                ],
                generationConfig: { temperature: 0 }
            }, { timeout: 10000 });
            const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join(' ')?.trim() ?? '';
            const amount = pickMaxAmount(text);
            const { pickup, dropoff } = parseLocations(text);
            if (amount == null || Number.isNaN(amount)) {
                return { amount: null, rawText: text, reason: 'NO_AMOUNT_FOUND', pickup, dropoff };
            }
            return { amount, rawText: text, pickup, dropoff };
        }
        catch (error) {
            const reason = error?.response?.data ?? error?.message ?? 'UNKNOWN_ERROR';
            errors.push(`${c.version}/${c.model}: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`);
            // try next fallback
            continue;
        }
    }
    return {
        amount: null,
        rawText: '',
        reason: `All models failed: ${errors.join(' | ')}`
    };
}
