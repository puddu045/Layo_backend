import {
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findPotentialMatches(userId: string, journeyLegId: string) {
    const currentLeg = await this.prisma.journeyLeg.findUnique({
      where: { id: journeyLegId },
      include: {
        journey: true,
      },
    });

    if (!currentLeg) {
      throw new NotFoundException('Journey leg not found');
    }

    if (currentLeg.journey.userId !== userId) {
      throw new ForbiddenException('You do not own the provided journey leg');
    }

    /**
     * STEP 1️⃣ Find users already interacted with on this exact leg
     */
    const existingMatches = await this.prisma.match.findMany({
      where: {
        flightNumber: currentLeg.flightNumber,
        departureTime: currentLeg.departureTime,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    });

    const excludedUserIds = new Set<string>();
    for (const m of existingMatches) {
      if (m.senderId !== userId) excludedUserIds.add(m.senderId);
      if (m.receiverId !== userId) excludedUserIds.add(m.receiverId);
    }

    /**
     * STEP 2️⃣ SAME FLIGHT, SAME LEG MATCHES ONLY
     */
    const sameFlightMatches = await this.prisma.journeyLeg.findMany({
      where: {
        id: { not: journeyLegId },

        flightNumber: currentLeg.flightNumber,
        departureTime: currentLeg.departureTime,
        departureAirport: currentLeg.departureAirport,
        arrivalAirport: currentLeg.arrivalAirport,

        journey: {
          userId: {
            not: userId,
            notIn: Array.from(excludedUserIds),
          },
        },
      },
      include: {
        journey: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return sameFlightMatches;
  }

  async createMatch(
    senderId: string,
    senderJourneyLegId: string,
    receiverId: string,
    receiverJourneyLegId: string,
  ) {
    if (senderId === receiverId) {
      throw new ConflictException('Cannot match with yourself');
    }

    // 1️⃣ Load sender journey leg and verify ownership
    const senderLeg = await this.prisma.journeyLeg.findUnique({
      where: { id: senderJourneyLegId },
      include: { journey: true },
    });

    if (!senderLeg || senderLeg.journey.userId !== senderId) {
      throw new ForbiddenException(
        'Sender does not own the provided journey leg',
      );
    }

    // 2️⃣ Load receiver journey leg and verify ownership
    const receiverLeg = await this.prisma.journeyLeg.findUnique({
      where: { id: receiverJourneyLegId },
      include: { journey: true },
    });

    if (!receiverLeg || receiverLeg.journey.userId !== receiverId) {
      throw new ForbiddenException(
        'Receiver does not own the provided journey leg',
      );
    }

    // 3️⃣ Validate same flight
    if (
      senderLeg.flightNumber !== receiverLeg.flightNumber ||
      senderLeg.departureTime.getTime() !== receiverLeg.departureTime.getTime()
    ) {
      throw new BadRequestException('Journey legs are not on the same flight');
    }

    // 4️⃣ Prevent duplicate interaction on this flight
    const existingMatch = await this.prisma.match.findFirst({
      where: {
        flightNumber: senderLeg.flightNumber,
        departureTime: senderLeg.departureTime,
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });

    if (existingMatch) {
      throw new ConflictException(
        'You have already interacted with this user on this flight',
      );
    }

    // 5️⃣ Create match
    return this.prisma.match.create({
      data: {
        senderId,
        receiverId,
        senderJourneyLegId,
        receiverJourneyLegId,
        flightNumber: senderLeg.flightNumber,
        departureTime: senderLeg.departureTime,
        status: 'PENDING',
      },
    });
  }

  private getLayoverWindow(leg: {
    arrivalTime: Date;
    layoverMinutes: number | null;
  }) {
    if (!leg.layoverMinutes) {
      return null;
    }

    const start = leg.arrivalTime;
    const end = new Date(start.getTime() + leg.layoverMinutes * 60 * 1000);

    return { start, end };
  }

  async getPendingMatchesForLeg(userId: string, journeyLegId: string) {
    // 1️⃣ Verify leg exists and ownership
    const leg = await this.prisma.journeyLeg.findUnique({
      where: { id: journeyLegId },
      include: { journey: true },
    });

    if (!leg) {
      throw new NotFoundException('Journey leg not found');
    }

    if (leg.journey.userId !== userId) {
      throw new ForbiddenException('You do not own this journey leg');
    }

    // 2️⃣ Fetch incoming pending requests (sent TO this user)
    return this.prisma.match.findMany({
      where: {
        status: 'PENDING',
        receiverId: userId,
        receiverJourneyLegId: journeyLegId,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true },
        },
        receiver: {
          select: { id: true, firstName: true, lastName: true },
        },
        senderJourneyLeg: true,
        receiverJourneyLeg: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async dismissPotentialMatch(
    userId: string,
    senderJourneyLegId: string,
    receiverId: string,
    receiverJourneyLegId: string,
  ) {
    // Same validation as createMatch
    const senderLeg = await this.prisma.journeyLeg.findUnique({
      where: { id: senderJourneyLegId },
      include: { journey: true },
    });

    if (!senderLeg || senderLeg.journey.userId !== userId) {
      throw new ForbiddenException('You do not own this journey leg');
    }

    const receiverLeg = await this.prisma.journeyLeg.findUnique({
      where: { id: receiverJourneyLegId },
      include: { journey: true },
    });

    if (!receiverLeg || receiverLeg.journey.userId !== receiverId) {
      throw new ForbiddenException('Invalid receiver journey leg');
    }

    // Must be same flight
    if (
      senderLeg.flightNumber !== receiverLeg.flightNumber ||
      senderLeg.departureTime.getTime() !== receiverLeg.departureTime.getTime()
    ) {
      throw new BadRequestException('Journey legs are not on the same flight');
    }

    // Prevent duplicates
    const existing = await this.prisma.match.findFirst({
      where: {
        flightNumber: senderLeg.flightNumber,
        departureTime: senderLeg.departureTime,
        OR: [
          { senderId: userId, receiverId },
          { senderId: receiverId, receiverId: userId },
        ],
      },
    });

    if (existing) {
      throw new ConflictException('Interaction already exists');
    }

    // Create REJECTED match directly
    return this.prisma.match.create({
      data: {
        senderId: userId,
        receiverId,
        senderJourneyLegId,
        receiverJourneyLegId,
        flightNumber: senderLeg.flightNumber,
        departureTime: senderLeg.departureTime,
        status: 'REJECTED',
      },
    });
  }

  async acceptMatch(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    // Only receiver can accept
    if (match.receiverId !== userId) {
      throw new ForbiddenException('You cannot accept this match');
    }

    if (match.status !== 'PENDING') {
      throw new BadRequestException('Match is no longer pending');
    }

    // Transaction: update match + create chat
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          status: 'ACCEPTED',
        },
      });

      const chat = await tx.chat.create({
        data: {
          matchId: matchId,
        },
      });

      await tx.chatReadState.createMany({
        data: [
          {
            chatId: chat.id,
            userId: match.senderId,
            lastReadAt: new Date(0),
          },
          {
            chatId: chat.id,
            userId: match.receiverId,
            lastReadAt: new Date(0),
          },
        ],
      });

      return {
        match: updatedMatch,
        chat,
      };
    });
  }

  async rejectMatch(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (match.receiverId !== userId) {
      throw new ForbiddenException('You cannot reject this match');
    }

    if (match.status !== 'PENDING') {
      throw new BadRequestException('Match is no longer pending');
    }

    return this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'REJECTED',
      },
    });
  }
}
