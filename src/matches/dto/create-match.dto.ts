import { IsNotEmpty } from 'class-validator';

export class CreateMatchDto {
  @IsNotEmpty()
  journeyLegId: string;

  @IsNotEmpty()
  receiverId: string;
}
