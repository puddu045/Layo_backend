import { IsInt, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateJourneyLegDto {
  @IsInt()
  sequence: number;

  @IsNotEmpty()
  flightNumber: string;

  @IsNotEmpty()
  departureAirport: string;

  @IsNotEmpty()
  arrivalAirport: string;

  @IsDateString()
  departureTime: string;

  @IsDateString()
  arrivalTime: string;
}
