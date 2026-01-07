import { IsUUID } from 'class-validator';

export class DismissMatchDto {
  @IsUUID()
  senderJourneyLegId: string;

  @IsUUID()
  receiverId: string;

  @IsUUID()
  receiverJourneyLegId: string;
}
