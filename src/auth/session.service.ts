import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UserLoginDto } from './dto/user-login.dto';
import { CreateSessionDtoSchema } from './dto/create-session.dto';
import type { CreateSessionDto } from './dto/create-session.dto';

type Session = {
  userId: string;
  expiresAt: number;
};
@Injectable()
export class SessionService {
  private session = new Map<string, Session>();
  constructor(private readonly prisma: PrismaService) {}

  createSession(dto: CreateSessionDto) {
    //create a uuid
    const sid = crypto.randomUUID();
    this.session.set(sid, {
      userId: dto.userId,
      expiresAt: Date.now() + 604800000, // 7 Days
    });

    return sid;
  }

  getUserId(sid: string) {
    const session = this.session.get(sid);
    if (!session) return null;

    if (session?.expiresAt < Date.now()) {
      this.session.delete(sid);
      return null;
    }
    return session.userId
  }
}
