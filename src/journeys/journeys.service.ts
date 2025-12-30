import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJourneyDto } from './dto/create-journey.dto';

@Injectable()
export class JourneysService {
  constructor(private readonly prisma: PrismaService) {}

  async createJourney(userId: string, dto: CreateJourneyDto) {
    if (!dto.legs || dto.legs.length === 0) {
      throw new BadRequestException('Journey must have at least one leg');
    }

    // Sort legs by sequence
    const legs = [...dto.legs].sort((a, b) => a.sequence - b.sequence);

    // Calculate layover minutes
    const legsWithLayovers = legs.map((leg, index) => {
      if (index === legs.length - 1) {
        return { ...leg, layoverMinutes: null };
      }

      const currentArrival = new Date(leg.arrivalTime);
      const nextDeparture = new Date(legs[index + 1].departureTime);

      const diffMinutes =
        (nextDeparture.getTime() - currentArrival.getTime()) / 60000;

      if (diffMinutes < 0) {
        throw new BadRequestException(
          'Invalid leg timing: arrival after next departure',
        );
      }

      return { ...leg, layoverMinutes: Math.floor(diffMinutes) };
    });

    // Use transaction to keep data consistent
    return this.prisma.$transaction(async (tx) => {
      const journey = await tx.journey.create({
        data: {
          userId,
          journeyType: dto.journeyType,
          flightNumber: legs[0].flightNumber,
          departureAirport: legs[0].departureAirport,
          arrivalAirport: legs[legs.length - 1].arrivalAirport,
          departureTime: new Date(legs[0].departureTime),
          arrivalTime: new Date(legs[legs.length - 1].arrivalTime),
        },
      });

      await tx.journeyLeg.createMany({
        data: legsWithLayovers.map((leg) => ({
          journeyId: journey.id,
          sequence: leg.sequence,
          flightNumber: leg.flightNumber,
          departureAirport: leg.departureAirport,
          arrivalAirport: leg.arrivalAirport,
          departureTime: new Date(leg.departureTime),
          arrivalTime: new Date(leg.arrivalTime),
          layoverMinutes: leg.layoverMinutes,
        })),
      });

      return journey;
    });
  }

  async getJourneysForUser(userId: string) {
    return this.prisma.journey.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        legs: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  async getJourneyById(userId: string, journeyId: string) {
    const journey = await this.prisma.journey.findFirst({
      where: {
        id: journeyId,
        userId, // ownership check
      },
      include: {
        legs: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });

    if (!journey) {
      throw new NotFoundException('Journey not found');
    }

    return journey;
  }
}
