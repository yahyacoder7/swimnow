import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { ConfigService } from '@nestjs/config';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(3000);
}
void bootstrap();
