-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userid" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "gender" TEXT,
    "phone" TEXT,
    "birthDate" TIMESTAMP(3),
    "smsConsent" BOOLEAN NOT NULL DEFAULT false,
    "termsConsent" BOOLEAN NOT NULL DEFAULT true,
    "paymentPassword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userid_key" ON "User"("userid");
