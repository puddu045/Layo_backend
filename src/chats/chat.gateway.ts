/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatsService } from './chats.service';

interface JwtPayload {
  sub: string;
}

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
  };
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatsService: ChatsService,
  ) {}

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        socket.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      socket.data.userId = payload.sub;
      socket.join(`user:${payload.sub}`);
    } catch (err) {
      socket.disconnect();
    }
  }

  handleDisconnect(_socket: AuthenticatedSocket) {
    // optional cleanup later
  }

  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @MessageBody() body: { chatId: string },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    const userId = socket.data.userId;

    const canJoin = await this.chatsService.canUserAccessChat(
      userId,
      body.chatId,
    );

    if (!canJoin) return;

    socket.join(`chat:${body.chatId}`);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() body: { tempId: string; chatId: string; content: string },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    const userId = socket.data.userId;

    try {
      const message = await this.chatsService.createMessage({
        chatId: body.chatId,
        senderId: userId,
        content: body.content,
      });

      this.server.to(`chat:${body.chatId}`).emit('new_message', {
        ...message,
        tempId: body.tempId,
      });

      return message;
    } catch (err) {
      console.error('MESSAGE SAVE FAILED', {
        chatId: body.chatId,
        userId,
        err,
      });
    }
  }
}
