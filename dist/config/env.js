import dotenv from "dotenv";
dotenv.config();
const normalizeCorsOrigin = (value) => {
    if (!value || value === "*")
        return "*";
    const list = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    return list.length > 0 ? list : true;
};
export const ENV = {
    NODE_ENV: process.env.NODE_ENV ?? "development",
    PORT: Number(process.env.PORT ?? 4000),
    CORS_ORIGIN: normalizeCorsOrigin(process.env.CORS_ORIGIN),
};
export const env = ENV;
