import { IsUUID } from 'class-validator';

export class CreateMatchDto {
  @IsUUID()
  senderJourneyId: string;

  @IsUUID()
  receiverJourneyId: string;

  @IsUUID()
  receiverId: string;
}
