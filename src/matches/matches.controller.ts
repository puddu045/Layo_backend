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

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get('potential/:journeyLegId')
  async getPotentialMatches(
    @Req() req: express.Request,
    @Param('journeyLegId') journeyLegId: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.matchesService.findPotentialMatches(userId, journeyLegId);
  }
  @Post()
  async sendMatch(@Req() req: express.Request, @Body() dto: CreateMatchDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const senderId = (req.user as any).userId;

    return this.matchesService.createMatch(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      senderId,
      dto.journeyLegId,
      dto.receiverId,
    );
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
