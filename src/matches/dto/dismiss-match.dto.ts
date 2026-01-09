import { IsUUID } from 'class-validator';

export class DismissMatchDto {
  @IsUUID()
  senderJourneyId: string;

  @IsUUID()
  receiverId: string;

  @IsUUID()
  receiverJourneyId: string;
}
