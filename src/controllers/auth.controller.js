import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
// ❗ 경로/네임드 익스포트 맞추기
import { prisma } from "../lib/prisma.js";

// POST /api/auth/signup
export const signup = async (req, res) => {
  try {
    const { email, password, nickname } = req.body;

    if (!email || !password || !nickname) {
      return res.status(400).json({ message: "email, password, nickname은 필수입니다." });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(409).json({ message: "이미 가입된 이메일입니다." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        nickname,
      },
      select: { id: true, email: true, nickname: true, createdAt: true },
    });

    return res.status(201).json({ message: "회원가입 성공", user });
  } catch (err) {
    console.error("signup error:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.status(200).json({
      message: "로그인 성공",
      token,
      user: { id: user.id, email: user.email, nickname: user.nickname },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
};
