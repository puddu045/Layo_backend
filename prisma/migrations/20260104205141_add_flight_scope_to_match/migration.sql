/*
  Warnings:

  - Added the required column `departureTime` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `flightNumber` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "departureTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "flightNumber" TEXT NOT NULL;
