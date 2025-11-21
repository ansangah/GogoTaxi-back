/*
  Warnings:

  - The values [OPEN,LOCKED,COMPLETED,CANCELED] on the enum `RoomStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `createdAt` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `departureTime` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `fromLat` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `fromLng` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `hostId` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `rule` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `toLat` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `toLng` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `RoomMember` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `arrival_label` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `arrival_lat` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `arrival_lng` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creator_id` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departure_label` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departure_lat` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departure_lng` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departure_time` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priority` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "RoomPriority" AS ENUM ('time', 'seats');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('pending', 'deposit_collected', 'host_paid', 'settling', 'settled');

-- CreateEnum
CREATE TYPE "WalletTxKind" AS ENUM ('top_up', 'auto_top_up', 'hold_deposit', 'host_charge', 'extra_collect', 'refund', 'host_refund', 'adjustment');

-- CreateEnum
CREATE TYPE "WalletTxStatus" AS ENUM ('pending', 'success', 'failed');

-- CreateEnum
CREATE TYPE "SettlementRole" AS ENUM ('host', 'guest');

-- CreateEnum
CREATE TYPE "NoticeType" AS ENUM ('update', 'info', 'maintenance');

-- CreateEnum
CREATE TYPE "SettlementRecordStatus" AS ENUM ('pending', 'settling', 'settled', 'failed');

-- AlterEnum
BEGIN;
CREATE TYPE "RoomStatus_new" AS ENUM ('recruiting', 'dispatching', 'success', 'failed');
ALTER TABLE "public"."Room" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Room" ALTER COLUMN "status" TYPE "RoomStatus_new" USING ("status"::text::"RoomStatus_new");
ALTER TYPE "RoomStatus" RENAME TO "RoomStatus_old";
ALTER TYPE "RoomStatus_new" RENAME TO "RoomStatus";
DROP TYPE "public"."RoomStatus_old";
ALTER TABLE "Room" ALTER COLUMN "status" SET DEFAULT 'recruiting';
COMMIT;

-- DropForeignKey
ALTER TABLE "Room" DROP CONSTRAINT "Room_hostId_fkey";

-- DropForeignKey
ALTER TABLE "RoomMember" DROP CONSTRAINT "RoomMember_roomId_fkey";

-- DropForeignKey
ALTER TABLE "RoomMember" DROP CONSTRAINT "RoomMember_userId_fkey";

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "createdAt",
DROP COLUMN "departureTime",
DROP COLUMN "fromLat",
DROP COLUMN "fromLng",
DROP COLUMN "hostId",
DROP COLUMN "name",
DROP COLUMN "rule",
DROP COLUMN "toLat",
DROP COLUMN "toLng",
DROP COLUMN "updatedAt",
ADD COLUMN     "actual_fare" INTEGER,
ADD COLUMN     "arrival_label" TEXT NOT NULL,
ADD COLUMN     "arrival_lat" DECIMAL(10,6) NOT NULL,
ADD COLUMN     "arrival_lng" DECIMAL(10,6) NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "creator_id" TEXT NOT NULL,
ADD COLUMN     "departure_label" TEXT NOT NULL,
ADD COLUMN     "departure_lat" DECIMAL(10,6) NOT NULL,
ADD COLUMN     "departure_lng" DECIMAL(10,6) NOT NULL,
ADD COLUMN     "departure_time" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "estimated_eta" TIMESTAMP(3),
ADD COLUMN     "estimated_fare" INTEGER,
ADD COLUMN     "no_show_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "priority" "RoomPriority" NOT NULL,
ADD COLUMN     "settlement_status" "SettlementStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "title" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'recruiting';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "createdAt",
DROP COLUMN "passwordHash",
ADD COLUMN     "birth_date" TIMESTAMP(3),
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "sms_consent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "terms_consent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wallet_balance" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "nickname" DROP NOT NULL;

-- DropTable
DROP TABLE "RoomMember";

-- DropEnum
DROP TYPE "RoomRule";

-- CreateTable
CREATE TABLE "RoomParticipant" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "seat_number" INTEGER,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "room_id" TEXT,
    "idempotency_key" TEXT,
    "kind" "WalletTxKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "status" "WalletTxStatus" NOT NULL DEFAULT 'success',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomSettlement" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "SettlementRole" NOT NULL,
    "deposit" INTEGER NOT NULL DEFAULT 0,
    "extra_collect" INTEGER NOT NULL DEFAULT 0,
    "refund" INTEGER NOT NULL DEFAULT 0,
    "net_amount" INTEGER NOT NULL DEFAULT 0,
    "no_show" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "status" "SettlementRecordStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "room_id" TEXT NOT NULL,
    "reviewer_user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "room_id" TEXT NOT NULL,
    "reporter_user_id" TEXT NOT NULL,
    "reported_seat_number" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchedTaxi" (
    "id" SERIAL NOT NULL,
    "room_id" TEXT NOT NULL,
    "driver_name" TEXT NOT NULL,
    "car_model" TEXT NOT NULL,
    "car_number" TEXT NOT NULL,

    CONSTRAINT "DispatchedTaxi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "NoticeType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomParticipant_room_id_user_id_key" ON "RoomParticipant"("room_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_idempotency_key_key" ON "WalletTransaction"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "RoomSettlement_room_id_user_id_key" ON "RoomSettlement"("room_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchedTaxi_room_id_key" ON "DispatchedTaxi"("room_id");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomParticipant" ADD CONSTRAINT "RoomParticipant_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomParticipant" ADD CONSTRAINT "RoomParticipant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomSettlement" ADD CONSTRAINT "RoomSettlement_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomSettlement" ADD CONSTRAINT "RoomSettlement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchedTaxi" ADD CONSTRAINT "DispatchedTaxi_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
