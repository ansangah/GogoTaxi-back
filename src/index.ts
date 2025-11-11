// src/index.ts (백엔드)

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt'; // bcrypt import 확인

const app = express();
const port = 3000;

const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.get('/api/test', (req, res) => {
  res.json({ message: '백엔드 서버 동작 중! 🚀' });
});

// 4. 회원가입 API (POST /api/auth/register)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { userid, pw, name, gender, sms, terms } = req.body;

    if (!userid || !pw || !name) {
      return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
    }

    const hashedPassword = await bcrypt.hash(pw, 10);

    const newUser = await prisma.user.create({
      data: {
        userid, // 'userid: userid'의 축약형
        password: hashedPassword,
        name,
        gender: gender || null,
        smsConsent: sms || false,
        termsConsent: terms || true,
      },
    });

    res.status(201).json({
      message: '회원가입 성공!',
      userId: newUser.id,
    });
  } catch (error: any) {
    if (error.code === 'P2002' && error.meta?.target?.includes('userid')) {
      return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
    }
    console.error(error);
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// --- ⬇️ [신규] 로그인 API 추가 ⬇️ ---

app.post('/api/auth/login', async (req, res) => {
  try {
    const { id, pw } = req.body; // 프론트에서 id, pw로 보냅니다.

    if (!id || !pw) {
      return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });
    }

    // 1. DB에서 아이디로 사용자 찾기
    const user = await prisma.user.findUnique({
      where: {
        userid: id, // 스키마의 'userid' 필드로 찾음
      },
    });

    // 2. 사용자가 없으면
    if (!user) {
      return res.status(404).json({ error: '존재하지 않는 아이디입니다.' });
    }

    // 3. 비밀번호 비교
    const isPasswordValid = await bcrypt.compare(pw, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

    // 4. 로그인 성공 (나중에는 여기서 JWT 토큰을 발급합니다)
    res.status(200).json({
      message: '로그인 성공!',
      user: {
        id: user.id,
        userid: user.userid,
        name: user.name,
      },
    });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// --- ⬇️ [신규] 내 프로필 조회 API 추가 ⬇️ ---

app.get('/api/profile/:userid', async (req, res) => {
  try {
    const { userid } = req.params; // URL 경로에서 :userid 값을 가져옴

    // 1. DB에서 해당 아이디의 사용자 찾기
    const user = await prisma.user.findUnique({
      where: {
        userid: userid,
      },
      // ⚠️ 중요: 비밀번호를 제외하고 필요한 정보만 선택해서 보냅니다.
      select: {
        id: true,
        userid: true,
        name: true,
        gender: true,
        phone: true,
        birthDate: true,
      },
    });

    // 2. 사용자가 없으면 404 에러
    if (!user) {
      return res.status(404).json({ error: '사용자 정보를 찾을 수 없습니다.' });
    }

    // 3. 사용자 정보를 프론트엔드에 전송
    res.status(200).json(user);

  } catch (error: any) {
    console.error('프로필 조회 오류:', error);
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// --- ⬆️ [신규] 내 프로필 조회 API 추가 ⬆️ ---

app.listen(port, () => {
  console.log(`🚀 백엔드 서버가 http://localhost:${port} 에서 실행 중입니다.`);
});