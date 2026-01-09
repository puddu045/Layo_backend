import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import express from 'express';
import { CreateMatchDto } from './dto/create-match.dto';
import { DismissMatchDto } from './dto/dismiss-match.dto';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get('journey/:journeyId')
  async getMatchesByJourney(
    @Req() req: express.Request,
    @Param('journeyId') journeyId: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.matchesService.findMatchesByJourney(userId, journeyId);
  }

  @Post()
  async sendMatch(@Req() req: express.Request, @Body() dto: CreateMatchDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const senderId = (req.user as any).userId;

    return this.matchesService.createMatch(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      senderId,
      dto.senderJourneyId,
      dto.receiverId,
      dto.receiverJourneyId,
    );
  }

  @Post('dismiss')
  async dismissPotentialMatch(
    @Req() req: express.Request,
    @Body() dto: DismissMatchDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;

    return this.matchesService.dismissPotentialMatch(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      userId,
      dto.senderJourneyId,
      dto.receiverId,
      dto.receiverJourneyId,
    );
  }

  @Get('pending/:journeyId')
  async getPendingMatches(
    @Req() req: express.Request,
    @Param('journeyId') journeyId: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;

    return this.matchesService.getPendingMatchesForJourney(userId, journeyId);
  }

  @Post(':id/accept')
  async accept(@Req() req: express.Request, @Param('id') matchId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.matchesService.acceptMatch(matchId, userId);
  }

  @Post(':id/reject')
  async reject(@Req() req: express.Request, @Param('id') matchId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.matchesService.rejectMatch(matchId, userId);
  }
}
