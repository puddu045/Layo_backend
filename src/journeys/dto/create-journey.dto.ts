import { IsArray, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JourneyType } from '@prisma/client';
import { CreateJourneyLegDto } from './create-journey-leg.dto';

export class CreateJourneyDto {
  @IsEnum(JourneyType)
  journeyType: JourneyType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJourneyLegDto)
  legs: CreateJourneyLegDto[];
}
