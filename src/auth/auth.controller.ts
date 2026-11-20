import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe-';
import { UserLoginDtoSchema } from './dto/user-login.dto'
import type { UserLoginDto } from './dto/user-login.dto';
@Controller('auth')
export class AuthController {

    constructor(
        private readonly authService: AuthService
    ){}
  @Post('login')
  async validate(
    @Body(new ZodValidationPipe(UserLoginDtoSchema)) dto:UserLoginDto  ) {

   const res = await this.authService.validateUser(dto);

   return res;
  }
}

