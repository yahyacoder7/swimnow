import { Injectable } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './session.service';
import type { UserLoginDto } from './dto/user-login.dto';
import type { CreateSessionDto } from './dto/create-session.dto';
import * as bcrypt from 'bcrypt';
@Injectable()
export class AuthService {
  private readonly sessionService: SessionService;
  constructor(
    private readonly prisma: PrismaService,
    sessionService: SessionService,
  ) {
    this.sessionService = sessionService;
  }
  /**
   * * Prevents timing attacks by using a dummy hash when the user is not found.
   */
  private readonly DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

  async validateUser(dto: UserLoginDto): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const ok = await bcrypt.compare(
      dto.password,
      user?.password ?? this.DUMMY_HASH,
    );
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid Email or Password');
    }
    /**
     * * If you arrive here means the user is valid and you can create a session for the user.
     */
    const userData: CreateSessionDto = {
      userId: user.id,
    };
    const sessionId = this.sessionService.createSession(userData);
    const { password, ...restUser } = user;

    const result = {
      restUser,
      sessionId,
    };
    return result;
  }
}
