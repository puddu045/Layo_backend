import { IsUUID } from 'class-validator';

export class CreateMatchDto {
  @IsUUID()
  senderJourneyLegId: string;

  @IsUUID()
  receiverJourneyLegId: string;

  @IsUUID()
  receiverId: string;
}
