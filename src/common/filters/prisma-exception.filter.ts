import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

/**
 * Global exception filter: catches EVERY Prisma error in the app and converts
 * it into a safe JSON response. We never have to write try/catch in services.
 *
 * Two audiences:
 *  - CLIENT  → gets only a generic, safe message (no DB names, no P-codes).
 *  - LOGS    → the full technical detail (code + raw message) for us.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientValidationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  // ---------------------------------------------------------------------------
  // THE MAPPING TABLE. Add ONE line here when a new P-code shows up in the logs.
  // ---------------------------------------------------------------------------
  private static readonly TABLE: Record<
    string,
    { status: HttpStatus; clientMessage: string }
  > = {
    // ============================================================
    // CONNECTION ERRORS — the database server is not reachable
    // ============================================================

    // P1001 — "Cannot reach database server".
    // Cause: DB container is down, or host/port/user are wrong in
    // DATABASE_URL (.env). Not a pool problem — check docker compose + .env.
    P1001: { status: 503, clientMessage: 'Service temporarily unavailable' },

    // P1002 — "Server responded too slowly". DB was reached but the request
    // timed out (overloaded DB / network). Transient — retry usually works.
    P1002: { status: 504, clientMessage: 'Request timed out' },

    // P1008 — "Operation timed out". THE QUERY ITSELF ran too long
    // (heavy query or missing index). Not related to the pool — optimize
    // the query / add an index.
    P1008: { status: 504, clientMessage: 'Request timed out' },

    // P1017 — "Server closed the connection". DB restarted/crashed mid-request.
    // Safe to retry: the pool opens a new connection automatically.
    P1017: { status: 503, clientMessage: 'Service temporarily unavailable' },

    // ============================================================
    // POOL ERRORS — linked to the pool config in PrismaService
    // ============================================================

    // P2024 — "Timed out fetching a connection from the pool".
    // CAUSE: the pool was exhausted — no free connection appeared within
    // `connectionTimeoutMillis` (default 5s), at pool size `max` (default 10).
    // FIX: raise `max` (and/or `connectionTimeoutMillis`) in PrismaService,
    // or reduce the load. See docs/connection-pool.md.
    P2024: { status: 503, clientMessage: 'Service is busy, try again' },

    // P2037 — "Too many connections" (Postgres hit its `max_connections` cap).
    // OPPOSITE fix from P2024: here `max` per app instance is TOO HIGH
    // (instances × max > max_connections). LOWER `max`, or add PgBouncer.
    P2037: { status: 503, clientMessage: 'Service temporarily unavailable' },

    // ============================================================
    // DATA ERRORS — the client's fault → we can explain it
    // ============================================================

    // P2002 — unique constraint violated, e.g. duplicate email on signup
    // or duplicate friend request.
    P2002: { status: 409, clientMessage: 'This value already exists' },

    // P2003 — foreign key violation: the related record does not exist
    // (e.g. comment on a deleted post).
    P2003: { status: 409, clientMessage: 'Related record not found' },

    // P2025 — record not found: the row was never created or was deleted.
    P2025: { status: 404, clientMessage: 'Record not found' },

    // ============================================================
    // PROGRAMMING BUGS — our fault → stay quiet on the client
    // ============================================================

    // P2028 — "Transaction API error": transactions used incorrectly in
    // our service code ($transaction mishandled). Not a DB problem.
    P2028: { status: 500, clientMessage: 'Something went wrong' },
  };

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    let code = '';
    let technicalMessage = '';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      code = exception.code; // e.g. "P2024"
      technicalMessage = exception.message;
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      code = exception.errorCode ?? 'P_INIT';
      technicalMessage = exception.message;
    } else if (
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientValidationError
    ) {
      code = 'P_GENERIC';
      technicalMessage = exception.message;
    }

    const rule = PrismaExceptionFilter.TABLE[code];
    const status = rule?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const clientMessage = rule?.clientMessage ?? 'Something went wrong';

    // Full detail goes to OUR logs only.
    this.logger.error(`[Prisma ${code}] ${technicalMessage}`);

    // 🤐 Client gets only the safe, generic message.
    response.status(status).json({
      statusCode: status,
      message: clientMessage,
    });
  }
}
