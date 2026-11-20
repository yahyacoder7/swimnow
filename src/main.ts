import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { ConfigService } from '@nestjs/config';
import  cookieParser from 'cookie-parser';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(3000);

  console.log(`Application is running on: http://localhost:3000/api/v1`);
}
void bootstrap();
