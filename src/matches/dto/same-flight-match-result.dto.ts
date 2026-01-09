export interface SameFlightMatchResult {
  myJourneyLeg: {
    id: string;
    journeyId: string;
    sequence: number;
    flightNumber: string;
    departureAirport: string;
    arrivalAirport: string;
    departureTime: Date;
    arrivalTime: Date;
    layoverMinutes: number | null;
    createdAt: Date;
  };

  otherJourneyLeg: {
    id: string;
    journeyId: string;
    sequence: number;
    flightNumber: string;
    departureAirport: string;
    arrivalAirport: string;
    departureTime: Date;
    arrivalTime: Date;
    layoverMinutes: number | null;
    createdAt: Date;
  };

  otherUser: {
    id: string;
    firstName: string;
    lastName: string;
  };
}
