import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UserLoginDto } from './dto/user-login.dto';
import { CreateSessionDtoSchema } from './dto/create-session.dto';
import type { CreateSessionDto } from './dto/create-session.dto';
@Injectable()
export class SessionService {
    private user = new Map<string, CreateSessionDto>();
  constructor(private readonly prisma: PrismaService) {}


  async createSession(dto: CreateSessionDto) {
    //create a uuid
    const sessionId = crypto.randomUUID();
    this.user.set('{$sessionId}' , dto);

    return sessionId;
  }
}