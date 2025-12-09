-- Guarded migration that re-applies the SocialAccount + RefreshToken schema
-- if it was missed on the target database. Each statement checks for existing
-- objects so rerunning the migration is safe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'AuthProvider'
  ) THEN
    CREATE TYPE "AuthProvider" AS ENUM ('kakao', 'google');
  END IF;
END$$;

-- Ensure newer RoomStatus values exist but avoid duplicate ADD VALUE errors.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'RoomStatus' AND e.enumlabel = 'recruiting'
  ) THEN
    ALTER TYPE "RoomStatus" ADD VALUE 'recruiting';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'RoomStatus' AND e.enumlabel = 'dispatching'
  ) THEN
    ALTER TYPE "RoomStatus" ADD VALUE 'dispatching';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'RoomStatus' AND e.enumlabel = 'success'
  ) THEN
    ALTER TYPE "RoomStatus" ADD VALUE 'success';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'RoomStatus' AND e.enumlabel = 'failed'
  ) THEN
    ALTER TYPE "RoomStatus" ADD VALUE 'failed';
  END IF;
END $$;

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "nickname",
  ALTER COLUMN "name" DROP NOT NULL,
  ALTER COLUMN "name" DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User'
    AND column_name = 'login_id'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "login_id" TEXT;
  END IF;
END $$;

ALTER TABLE "User"
  ALTER COLUMN "login_id" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "SocialAccount" (
    "id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "profile" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RefreshToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SocialAccount_user_id_idx"
  ON "SocialAccount"("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "SocialAccount_provider_provider_user_id_key"
  ON "SocialAccount"("provider", "provider_user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_token_hash_key"
  ON "RefreshToken"("token_hash");

CREATE UNIQUE INDEX IF NOT EXISTS "User_login_id_key"
  ON "User"("login_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SocialAccount_user_id_fkey'
  ) THEN
    ALTER TABLE "SocialAccount"
    ADD CONSTRAINT "SocialAccount_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RefreshToken_user_id_fkey'
  ) THEN
    ALTER TABLE "RefreshToken"
    ADD CONSTRAINT "RefreshToken_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
