import { Prisma } from '@prisma/client';

type LayoverLeg = Prisma.JourneyLegGetPayload<{
  include: {
    journey: {
      select: {
        id: true;
        user: {
          select: {
            id: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    };
  };
}>;

export interface LayoverMatchResult {
  journeyLegId: string;
  arrivalAirport: string;
  overlapMinutes: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
  leg: LayoverLeg;
}
