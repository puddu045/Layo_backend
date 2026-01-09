import {
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { LayoverMatchResult } from './dto/layover-match-result.dto';
import { SameFlightMatchResult } from './dto/same-flight-match-result.dto';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findMatchesByJourney(userId: string, journeyId: string) {
    const MIN_OVERLAP_MS = 90 * 60 * 1000; // 1.5 hours

    // 1️⃣ Load journey + ownership
    const journey = await this.prisma.journey.findUnique({
      where: { id: journeyId },
      include: { legs: true },
    });

    if (!journey) {
      throw new NotFoundException('Journey not found');
    }

    if (journey.userId !== userId) {
      throw new ForbiddenException('You do not own this journey');
    }

    // 2️⃣ Fetch matches involving this user ON THIS JOURNEY
    const existingMatches = await this.prisma.match.findMany({
      where: {
        AND: [
          {
            OR: [{ senderId: userId }, { receiverId: userId }],
          },
          {
            OR: [
              { senderJourneyId: journeyId },
              { receiverJourneyId: journeyId },
            ],
          },
        ],
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

    const sameFlightMatches: SameFlightMatchResult[] = [];
    const layoverMatches: LayoverMatchResult[] = [];

    // 3️⃣ Process each leg
    for (const leg of journey.legs) {
      /**
       * SAME FLIGHT MATCHES
       */
      const sameFlightLegs = await this.prisma.journeyLeg.findMany({
        where: {
          id: { not: leg.id },
          flightNumber: leg.flightNumber,
          departureAirport: leg.departureAirport,
          arrivalAirport: leg.arrivalAirport,
          departureTime: {
            gte: new Date(leg.departureTime.getTime() - 5 * 60 * 1000),
            lte: new Date(leg.departureTime.getTime() + 5 * 60 * 1000),
          },
          journey: {
            userId: {
              notIn: [userId, ...excludedUserIds],
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

      for (const otherLeg of sameFlightLegs) {
        sameFlightMatches.push({
          myJourneyLeg: leg,
          otherJourneyLeg: otherLeg,
          otherUser: otherLeg.journey.user,
        });
      }

      /**
       * LAYOVER MATCHES
       */
      if (!leg.layoverMinutes) continue;

      const currentWindow = this.getLayoverWindow(leg);
      if (!currentWindow) continue;

      const candidateLegs = await this.prisma.journeyLeg.findMany({
        where: {
          id: { not: leg.id },
          arrivalAirport: leg.arrivalAirport,
          layoverMinutes: { not: null },
          journey: {
            userId: {
              notIn: [userId, ...excludedUserIds],
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

      for (const otherLeg of candidateLegs) {
        const otherWindow = this.getLayoverWindow(otherLeg);
        if (!otherWindow) continue;

        const overlapStart = Math.max(
          currentWindow.start.getTime(),
          otherWindow.start.getTime(),
        );

        const overlapEnd = Math.min(
          currentWindow.end.getTime(),
          otherWindow.end.getTime(),
        );

        const overlapMs = overlapEnd - overlapStart;

        if (overlapMs >= MIN_OVERLAP_MS) {
          layoverMatches.push({
            journeyLegId: otherLeg.id,
            arrivalAirport: otherLeg.arrivalAirport,
            overlapMinutes: Math.floor(overlapMs / 60000),
            user: otherLeg.journey.user,
            leg: otherLeg,
          });
        }
      }
    }

    return {
      sameFlightMatches,
      layoverMatches,
    };
  }

  async createMatch(
    senderId: string,
    senderJourneyId: string,
    receiverId: string,
    receiverJourneyId: string,
  ) {
    if (senderId === receiverId) {
      throw new ConflictException('Cannot match with yourself');
    }

    const senderJourney = await this.prisma.journey.findUnique({
      where: { id: senderJourneyId },
    });

    if (!senderJourney || senderJourney.userId !== senderId) {
      throw new ForbiddenException('Sender does not own this journey');
    }

    const receiverJourney = await this.prisma.journey.findUnique({
      where: { id: receiverJourneyId },
    });

    if (!receiverJourney || receiverJourney.userId !== receiverId) {
      throw new ForbiddenException('Receiver does not own this journey');
    }

    // Same flight validation
    if (
      senderJourney.flightNumber !== receiverJourney.flightNumber ||
      senderJourney.departureTime.getTime() !==
        receiverJourney.departureTime.getTime()
    ) {
      throw new BadRequestException('Journeys are not on the same flight');
    }

    // Prevent duplicate interaction
    const existing = await this.prisma.match.findFirst({
      where: {
        flightNumber: senderJourney.flightNumber,
        departureTime: senderJourney.departureTime,
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        'You have already interacted with this user on this flight',
      );
    }

    return this.prisma.match.create({
      data: {
        senderId,
        receiverId,
        senderJourneyId,
        receiverJourneyId,
        flightNumber: senderJourney.flightNumber,
        departureTime: senderJourney.departureTime,
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

  async getPendingMatchesForJourney(userId: string, journeyId: string) {
    const journey = await this.prisma.journey.findUnique({
      where: { id: journeyId },
    });

    if (!journey) {
      throw new NotFoundException('Journey not found');
    }

    if (journey.userId !== userId) {
      throw new ForbiddenException('You do not own this journey');
    }

    return this.prisma.match.findMany({
      where: {
        status: 'PENDING',
        receiverId: userId,
        receiverJourneyId: journeyId,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true },
        },
        senderJourney: true,
        receiverJourney: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async dismissPotentialMatch(
    userId: string,
    senderJourneyId: string,
    receiverId: string,
    receiverJourneyId: string,
  ) {
    const senderJourney = await this.prisma.journey.findUnique({
      where: { id: senderJourneyId },
    });

    if (!senderJourney || senderJourney.userId !== userId) {
      throw new ForbiddenException('You do not own this journey');
    }

    const receiverJourney = await this.prisma.journey.findUnique({
      where: { id: receiverJourneyId },
    });

    if (!receiverJourney || receiverJourney.userId !== receiverId) {
      throw new ForbiddenException('Invalid receiver journey');
    }

    if (
      senderJourney.flightNumber !== receiverJourney.flightNumber ||
      senderJourney.departureTime.getTime() !==
        receiverJourney.departureTime.getTime()
    ) {
      throw new BadRequestException('Journeys are not on the same flight');
    }

    return this.prisma.match.create({
      data: {
        senderId: userId,
        receiverId,
        senderJourneyId,
        receiverJourneyId,
        flightNumber: senderJourney.flightNumber,
        departureTime: senderJourney.departureTime,
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
