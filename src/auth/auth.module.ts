import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionService } from './session.service';

@Module({
  providers: [AuthService, SessionService],
  controllers: [AuthController]
})
export class AuthModule {}
