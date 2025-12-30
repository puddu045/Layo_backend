import {
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
      return [];
    }

    // Same-flight matches
    const sameFlightMatches = await this.prisma.journeyLeg.findMany({
      where: {
        id: { not: journeyLegId },
        flightNumber: currentLeg.flightNumber,
        departureTime: currentLeg.departureTime,
        journey: {
          userId: { not: userId },
        },
        matches: {
          none: {
            OR: [{ senderId: userId }, { receiverId: userId }],
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

    // Layover-overlap matches
    const layoverWindow = this.getLayoverWindow(currentLeg);

    let layoverMatches;

    if (layoverWindow) {
      layoverMatches = await this.prisma.journeyLeg.findMany({
        where: {
          id: { not: journeyLegId },
          arrivalAirport: currentLeg.arrivalAirport,
          layoverMinutes: { not: null },
          journey: {
            userId: { not: userId },
          },
          matches: {
            none: {
              OR: [{ senderId: userId }, { receiverId: userId }],
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

      // Filter by time overlap in memory
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      layoverMatches = layoverMatches.filter((leg) => {
        const otherWindow = this.getLayoverWindow(leg);
        if (!otherWindow) return false;

        return (
          layoverWindow.start < otherWindow.end &&
          otherWindow.start < layoverWindow.end
        );
      });
    }

    // Merge & deduplicate
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const combined = [...sameFlightMatches, ...layoverMatches];

    const uniqueByUser = new Map<string, any>();

    for (const leg of combined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const user = leg.journey.user;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      uniqueByUser.set(user.id, leg);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Array.from(uniqueByUser.values());
  }

  async createMatch(
    senderId: string,
    journeyLegId: string,
    receiverId: string,
  ) {
    if (senderId === receiverId) {
      throw new ConflictException('Cannot match with yourself');
    }

    return this.prisma.match.create({
      data: {
        journeyLegId,
        senderId,
        receiverId,
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
    return this.prisma.$transaction(async (tx) => {
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
