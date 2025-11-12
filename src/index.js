// src/index.js  (ES Module)
// 실행 전 확인:
// 1) package.json => "type": "module"
// 2) .env => DATABASE_URL / JWT_SECRET / PORT 설정
// 3) npx prisma generate & npx prisma migrate dev 성공

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

dotenv.config();

// ---- 환경변수 체크 ----
const PORT = Number(process.env.PORT ?? 4000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn(
    "[WARN] JWT_SECRET 이 .env에 없습니다. 임시 키를 사용하면 토큰이 예측 가능해집니다. 실제 배포 전 반드시 설정하세요."
  );
}

// ---- 앱/DB 초기화 ----
const app = express();
const prisma = new PrismaClient({
  log: ["warn", "error"], // 필요 시 "query"도 추가 가능
});

app.use(cors());
app.use(express.json());

// ---- DB 연결 확인(부팅 시) ----
(async () => {
  try {
    await prisma.$connect();
    console.log("✅ Prisma DB connected");
  } catch (e) {
    console.error("❌ Prisma connect failed");
    console.error(e);
    // DB 연결이 안 되면 API 떠도 모든 요청이 실패하니 프로세스 종료하는게 낫다.
    process.exit(1);
  }
})();

// 정상 종료 시 Prisma 연결 정리
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// ---- 유틸 ----
const createToken = (userId) =>
  jwt.sign({ userId }, JWT_SECRET ?? "super-secret-change-me", {
    expiresIn: "1h",
  });

const requireAuth = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ message: "Unauthorized" });
  try {
    const { userId } = jwt.verify(
      auth.slice(7),
      JWT_SECRET ?? "super-secret-change-me"
    );
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// ---- 헬스/핑 ----
app.get("/health", (_req, res) => res.json({ ok: true }));

// DB 핑: DB 연결 문제 즉시 확인용
app.get("/db/ping", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ db: "ok" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ db: "fail", error: String(e) });
  }
});

// ---- Auth 라우트 (두 경로 모두 허용: /auth/*, /api/auth/*) ----
const registerHandler = async (req, res) => {
  try {
    const { email, name, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ message: "email, password required" });
    }
    // name을 스키마에 안 넣었으면 null 허용
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name: name ?? null, passwordHash },
      select: { id: true, email: true, name: true },
    });

    return res.status(201).json({
      token: createToken(user.id),
      user,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Registration failed" });
  }
};

const loginHandler = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    return res.json({
      token: createToken(user.id),
      user: { id: user.id, email: user.email, name: user.name ?? null },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Login failed" });
  }
};

const meHandler = (req, res) => {
  // requireAuth에서 req.user 채움
  res.json(req.user);
};

// /auth/*
app.post("/auth/register", registerHandler);
app.post("/auth/login", loginHandler);
app.get("/auth/me", requireAuth, meHandler);

// /api/auth/* (프론트가 이 경로를 쓰는 경우 대비)
app.post("/api/auth/register", registerHandler);
app.post("/api/auth/login", loginHandler);
app.get("/api/auth/me", requireAuth, meHandler);

// ---- 서버 시작 ----
app.listen(PORT, () => {
  console.log(`API ready on http://localhost:${PORT}`);
});
