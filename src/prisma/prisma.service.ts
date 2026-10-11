import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { Logger } from '@nestjs/common';

/**
 * Prisma 7 removed the built-in query engine, so a **driver adapter** is
 * mandatory. We use @prisma/adapter-pg (node-postgres) and pass the connection
 * string from ConfigService.
 *
 * Why extend PrismaClient: services inject this class and get the full typed
 * client (prisma.user.findMany(), etc.) with no wrapper boilerplate.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
   private readonly logger: Logger  = new Logger(PrismaService.name);
  constructor(
    private readonly config: ConfigService,
   
  ) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow('DATABASE_URL'),
      }),
    });
  }

  // Open the pool when the app boots.
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to database successfully');
    } catch (e) {
      this.logger.error('Failed to connect to database');
    }
  }

  // Close the pool when the app shuts down (avoids dangling connections).
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
