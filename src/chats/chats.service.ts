import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getChatsForUser(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        match: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
      },
      include: {
        match: {
          include: {
            sender: { select: { id: true, firstName: true } },
            receiver: { select: { id: true, firstName: true } },
          },
        },
        chatReadStates: {
          where: { userId },
          select: { lastReadAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      chats.map(async (chat) => {
        const lastReadAt = chat.chatReadStates[0]?.lastReadAt ?? new Date(0);

        const unreadCount = await this.prisma.message.count({
          where: {
            chatId: chat.id,

            createdAt: { gt: lastReadAt },
            senderId: { not: userId },
          },
        });

        return {
          ...chat,
          unreadCount,
        };
      }),
    );
  }

  async getChatsForUserByJourneyLeg(userId: string, journeyLegId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        match: {
          OR: [
            {
              senderId: userId,
              senderJourneyLegId: journeyLegId,
            },
            {
              receiverId: userId,
              receiverJourneyLegId: journeyLegId,
            },
          ],
        },
      },
      include: {
        match: {
          include: {
            sender: { select: { id: true, firstName: true } },
            receiver: { select: { id: true, firstName: true } },
          },
        },
        chatReadStates: {
          where: { userId },
          select: { lastReadAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      chats.map(async (chat) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const lastReadAt = chat.chatReadStates[0]?.lastReadAt ?? new Date(0);

        const unreadCount = await this.prisma.message.count({
          where: {
            chatId: chat.id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            createdAt: { gt: lastReadAt },
            senderId: { not: userId },
          },
        });

        return {
          ...chat,
          unreadCount,
        };
      }),
    );
  }

  async getMessages(
    chatId: string,
    userId: string,
    cursor?: string,
    limit = 30,
  ) {
    // 1. Ownership check (unchanged)
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { match: true },
    });

    if (
      !chat ||
      (chat.match.senderId !== userId && chat.match.receiverId !== userId)
    ) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    // 2. Build cursor condition
    const whereCondition: any = { chatId };

    if (cursor) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      whereCondition.createdAt = {
        lt: new Date(cursor), // older than cursor
      };
    }

    // 3. Fetch messages
    const messages = await this.prisma.message.findMany({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: whereCondition,
      orderBy: {
        createdAt: 'desc', // newest first
      },
      take: limit,
    });

    // 4. Return messages + next cursor
    const nextCursor =
      messages.length > 0
        ? messages[messages.length - 1].createdAt.toISOString()
        : null;

    return {
      messages,
      nextCursor,
    };
  }

  async sendMessage(chatId: string, senderId: string, content: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        match: true,
      },
    });

    if (
      !chat ||
      (chat.match.senderId !== senderId && chat.match.receiverId !== senderId)
    ) {
      throw new ForbiddenException('You do not have access to this chat');
    }

    return this.prisma.message.create({
      data: {
        chatId,
        senderId,
        content,
        type: 'TEXT',
      },
    });
  }

  async markChatAsRead(chatId: string, userId: string) {
    return this.prisma.chatReadState.upsert({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      update: {
        lastReadAt: new Date(),
      },
      create: {
        chatId,
        userId,
        lastReadAt: new Date(),
      },
    });
  }

  async getUnreadCount(chatId: string, userId: string) {
    const readState = await this.prisma.chatReadState.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    const lastReadAt = readState?.lastReadAt ?? new Date(0);

    return this.prisma.message.count({
      where: {
        chatId,
        createdAt: {
          gt: lastReadAt,
        },
        senderId: {
          not: userId,
        },
      },
    });
  }
}
