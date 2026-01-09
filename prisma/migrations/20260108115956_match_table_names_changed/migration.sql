/*
  Warnings:

  - You are about to drop the column `receiverJourneyLegId` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `senderJourneyLegId` on the `Match` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[senderJourneyId,receiverJourneyId,senderId,receiverId]` on the table `Match` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `receiverJourneyId` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senderJourneyId` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_receiverJourneyLegId_fkey";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_senderJourneyLegId_fkey";

-- DropIndex
DROP INDEX "Match_senderJourneyLegId_receiverJourneyLegId_senderId_rece_key";

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "receiverJourneyLegId",
DROP COLUMN "senderJourneyLegId",
ADD COLUMN     "receiverJourneyId" TEXT NOT NULL,
ADD COLUMN     "senderJourneyId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Match_flightNumber_departureTime_idx" ON "Match"("flightNumber", "departureTime");

-- CreateIndex
CREATE UNIQUE INDEX "Match_senderJourneyId_receiverJourneyId_senderId_receiverId_key" ON "Match"("senderJourneyId", "receiverJourneyId", "senderId", "receiverId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_senderJourneyId_fkey" FOREIGN KEY ("senderJourneyId") REFERENCES "Journey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_receiverJourneyId_fkey" FOREIGN KEY ("receiverJourneyId") REFERENCES "Journey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
