import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendMessageDto } from './dto/send-message.dto';
import express from 'express';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  async getMyChats(@Req() req: express.Request) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.chatsService.getChatsForUser(userId);
  }

  @Get('by-leg/:journeyLegId')
  async getChatsByJourneyLeg(
    @Req() req: express.Request,
    @Param('journeyLegId') journeyLegId: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.chatsService.getChatsForUserByJourneyLeg(userId, journeyLegId);
  }

  @Get(':id/messages')
  async getMessages(
    @Req() req: express.Request,
    @Param('id') chatId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;

    return this.chatsService.getMessages(
      chatId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      userId,
      cursor,
      limit ? Number(limit) : 30,
    );
  }

  @Post(':id/messages')
  async sendMessage(
    @Req() req: express.Request,
    @Param('id') chatId: string,
    @Body() dto: SendMessageDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const userId = (req.user as any).userId;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.chatsService.sendMessage(chatId, userId, dto.content);
  }

  @Post(':id/read')
  async markAsRead(@Req() req: express.Request, @Param('id') chatId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId = (req.user as any).userId;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await this.chatsService.markChatAsRead(chatId, userId);

    return { success: true };
  }
}
