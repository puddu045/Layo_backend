import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';

@Injectable()
export class AuthService {
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly refreshTokenSecret: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.accessTokenExpiry = this.config.getOrThrow('JWT_ACCESS_EXPIRY');
    this.refreshTokenExpiry = this.config.getOrThrow('JWT_REFRESH_EXPIRY');
    this.refreshTokenSecret = this.config.getOrThrow('JWT_REFRESH_SECRET');
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.createUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash,
      dateOfBirth: new Date(dto.dateOfBirth),
    });

    // Never return passwordHash
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    await this.saveRefreshToken(user.id, refreshToken);

    // Login successful
    return {
      accessToken,
      refreshToken,

      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  private async generateAccessToken(user: { id: string; email: string }) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
      },
      {
        expiresIn: this.accessTokenExpiry as ms.StringValue,
      },
    );
  }

  private async generateRefreshToken(user: { id: string; email: string }) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
      },
      {
        secret: this.refreshTokenSecret,
        expiresIn: this.refreshTokenExpiry as ms.StringValue,
      },
    );
  }

  private async saveRefreshToken(userId: string, token: string) {
    return this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt: new Date(
          Date.now() + this.parseExpiry(this.refreshTokenExpiry),
        ),
      },
    });
  }

  private parseExpiry(expiry: string): number {
    if (expiry.endsWith('d')) {
      return parseInt(expiry) * 24 * 60 * 60 * 1000;
    }
    if (expiry.endsWith('h')) {
      return parseInt(expiry) * 60 * 60 * 1000;
    }
    return 7 * 24 * 60 * 60 * 1000; // fallback 7 days
  }

  async refresh(dto: RefreshDto) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
    });

    if (!storedToken || storedToken.revoked) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Verify JWT signature
    let payload;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.refreshTokenSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Token rotation: revoke old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const user = await this.usersService.findByEmail(payload.email);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const newAccessToken = await this.generateAccessToken(user);
    const newRefreshToken = await this.generateRefreshToken(user);

    await this.saveRefreshToken(user.id, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revoked: true },
    });

    return { message: 'Logged out successfully' };
  }
}
