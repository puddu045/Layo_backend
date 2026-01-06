/*
  Warnings:

  - You are about to drop the column `journeyLegId` on the `Match` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[senderJourneyLegId,receiverJourneyLegId,senderId,receiverId]` on the table `Match` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `receiverJourneyLegId` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senderJourneyLegId` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_journeyLegId_fkey";

-- DropIndex
DROP INDEX "Match_journeyLegId_senderId_receiverId_key";

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "journeyLegId",
ADD COLUMN     "receiverJourneyLegId" TEXT NOT NULL,
ADD COLUMN     "senderJourneyLegId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Match_senderJourneyLegId_receiverJourneyLegId_senderId_rece_key" ON "Match"("senderJourneyLegId", "receiverJourneyLegId", "senderId", "receiverId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_senderJourneyLegId_fkey" FOREIGN KEY ("senderJourneyLegId") REFERENCES "JourneyLeg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_receiverJourneyLegId_fkey" FOREIGN KEY ("receiverJourneyLegId") REFERENCES "JourneyLeg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
