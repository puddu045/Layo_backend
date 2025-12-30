import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { JourneysService } from './journeys.service';
import { CreateJourneyDto } from './dto/create-journey.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import express from 'express';

@Controller('journeys')
@UseGuards(JwtAuthGuard)
export class JourneysController {
  constructor(private readonly journeysService: JourneysService) {}

  @Post()
  async create(@Req() req: express.Request, @Body() dto: CreateJourneyDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.journeysService.createJourney(userId, dto);
  }

  @Get()
  async findAll(@Req() req: express.Request) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.journeysService.getJourneysForUser(userId);
  }

  @Get(':id')
  async findOne(@Req() req: express.Request, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.journeysService.getJourneyById(userId, id);
  }
}
