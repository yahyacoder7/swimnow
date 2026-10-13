# Prisma Exception Filter — fully explained

**File:** `src/common/filters/prisma-exception.filter.ts`
**Goal:** catch **every** Prisma error in the app and turn it into a clean,
safe HTTP response — without writing `try/catch` in any service.

---

## 1. The goal, in one picture

```
request ─► controller ─► service ─► prisma (PrismaService)
                                        │
                    prisma throws P2024  │  (pool timeout)
                                        ▼
                 the error travels UP the request by itself
                                        │
                                        ▼
        ❗ PrismaExceptionFilter catches it (like one global catch{})
           • reads the code  → P2024
           • looks it up in the TABLE → 503 + safe message
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                        ▼
        CLIENT gets:                            OUR LOGS get:
        { statusCode: 503,                      [Prisma P2024] <raw
          message: "Service is busy" }           technical message>
```

Two rules, always:

| Audience                         | Gets                                                                    |
| -------------------------------- | ----------------------------------------------------------------------- |
| **Client** (the app / user)      | a generic, **safe** message. No DB names, no `P-codes`, no stack traces |
| **Us** (developers, server logs) | the **full** technical detail — code + raw message                      |

Why: exposing internals (DB name, "Prisma", connection info) is a security leak,
and `P2024` means nothing to a user anyway.

---

## 2. Where it lives & how it's switched on

It's an **NestJS exception filter**, registered **once globally** in `main.ts`:

```ts
const app = await NestFactory.create(AppModule);
app.useGlobalFilters(new PrismaExceptionFilter()); // ← one line, whole app
```

Because it's global, it covers **every** module automatically. Feature services
(users, posts, friends…) never import it and never write `try/catch`.

---

## 3. What Nest provides (the machinery)

| Nest piece           | What it does                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `ExceptionFilter`    | The interface you implement. Nest funnels thrown errors through filters.                  |
| `@Catch(...)`        | Declares **which** error types this filter handles.                                       |
| `ArgumentsHost`      | The bridge to the current request/response. `host.switchToHttp()` gives the HTTP context. |
| `useGlobalFilters()` | Registers the filter for the entire app (once, in `main.ts`).                             |
| `HttpStatus`         | Readable names (`HttpStatus.SERVICE_UNAVAILABLE`) instead of magic numbers (`503`).       |
| `Logger`             | Nest's logger — writes to our terminal.                                                   |

---

## 4. What Prisma provides (the error classes)

This is the key: Prisma throws **typed error objects**, each carrying a code.
Without these classes we couldn't tell a pool timeout from a random crash.

| Prisma error class                | Carries                                            | Used for                                               |
| --------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| `PrismaClientKnownRequestError`   | `.code` → **`P2xxx`** (`P2002`, `P2024`, `P2037`…) | errors during query execution                          |
| `PrismaClientInitializationError` | `.errorCode` → **`P1000`–`P1017`**                 | can't connect / initialize                             |
| `PrismaClientUnknownRequestError` | `.message`                                         | the engine returned something Prisma doesn't recognize |
| `PrismaClientValidationError`     | `.message`                                         | **we** called a query wrong (programming bug, no code) |

All four are reached through the `Prisma` namespace exported by our generated
client: `import { Prisma } from '../../generated/prisma/client'`.

So the contract is: **Prisma throws + tells us the code → we write the
meaning** (which HTTP status, which message).

---

## 5. The code, line by line

```ts
// 1-7 — Nest toolkit.
//   ExceptionFilter = the interface · @Catch = which errors
//   ArgumentsHost = request/response access · HttpStatus = 503/409/404 names
//   Logger = our terminal logs
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';

// 8 — the response object's TYPE (so .status().json() is type-safe)
import { Response } from 'express';

// 9 — Prisma's 4 error classes + model types, from OUR generated client
import { Prisma } from '../../generated/prisma/client';

/**
 * 11-18 — what this file does, and the "two audiences" rule.
 */
```

```ts
// 19-24 — Tell Nest: "route these 4 error types into this filter"
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientValidationError,
)
// 25 — this class IS an ExceptionFilter
export class PrismaExceptionFilter implements ExceptionFilter {
  // 26 — a logger tagged "PrismaExceptionFilter" (appears in every log line)
  private readonly logger = new Logger(PrismaExceptionFilter.name);
```

```ts
  // 28-34 — THE TABLE: a plain object { "P2024": { status, clientMessage } }
  //   static  → one shared copy for the whole app (not rebuilt per request)
  //   Record<string, {...}> → "keys are strings, values are {status, message}"
  private static readonly TABLE: Record<
    string,
    { status: HttpStatus; clientMessage: string }
  > = {
    // 35-94 — the entries, grouped by category (see section 6). Example:
    P2024: { status: 503, clientMessage: 'Service is busy, try again' },
  };

  // 97 — the ONLY method an ExceptionFilter must have.
  //   exception = the thrown error (type `unknown` → we must narrow it)
  //   host      = how to reach the current request/response
  catch(exception: unknown, host: ArgumentsHost) {
    // 98 — grab the HTTP response
    const response = host.switchToHttp().getResponse<Response>();

    // 100-101 — the two things we will fill in
    let code = '';
    let technicalMessage = '';

    // 103-115 — instanceof narrowing: WHICH error class is it?
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      code = exception.code; // e.g. "P2024"
      technicalMessage = exception.message;
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      code = exception.errorCode ?? 'P_INIT'; // e.g. "P1001"
      technicalMessage = exception.message;
    } else if (
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientValidationError
    ) {
      code = 'P_GENERIC';
      technicalMessage = exception.message;
    }

    // 117 — look up our table by the code
    const rule = PrismaExceptionFilter.TABLE[code];

    // 118-119 — use the mapped values, or safe fallbacks
    const status = rule?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const clientMessage = rule?.clientMessage ?? 'Something went wrong';

    // 122 — 🔒 full detail goes to OUR logs only
    this.logger.error(`[Prisma ${code}] ${technicalMessage}`);

    // 125-128 — 🤐 the client gets only the safe, generic message
    response.status(status).json({
      statusCode: status,
      message: clientMessage,
    });
  }
}
```

---

## 6. The mapping table (code → HTTP → cause)

| Code    | HTTP | Client message                  | Cause                                                       | Related config                        |
| ------- | ---- | ------------------------------- | ----------------------------------------------------------- | ------------------------------------- |
| `P1001` | 503  | Service temporarily unavailable | DB server unreachable (container down, bad host/port)       | `DATABASE_URL` in `.env`              |
| `P1002` | 504  | Request timed out               | DB reached but responded too slowly (transient)             | —                                     |
| `P1008` | 504  | Request timed out               | The query itself ran too long (heavy query / missing index) | —                                     |
| `P1017` | 503  | Service temporarily unavailable | Server closed the connection mid-request (restart/crash)    | —                                     |
| `P2024` | 503  | Service is busy, try again      | Pool exhausted — no free connection within the timeout      | **`max`** + `connectionTimeoutMillis` |
| `P2037` | 503  | Service temporarily unavailable | DB hit its `max_connections` cap ("too many clients")       | **`max`** too high → lower it         |
| `P2002` | 409  | This value already exists       | Unique constraint violated (e.g. duplicate email)           | your data                             |
| `P2003` | 409  | Related record not found        | Foreign key violation (related row missing)                 | your data                             |
| `P2025` | 404  | Record not found                | Row never existed / was deleted                             | your data                             |
| `P2028` | 500  | Something went wrong            | Transaction API used wrong (our bug)                        | service code                          |

**Note the trap:** `P2024` and `P2037` have **opposite fixes**. `P2024` = pool
too small → raise `max`. `P2037` = total connections too many → lower `max`
(or add PgBouncer). See `docs/connection-pool.md`.

---

## 7. How to handle a NEW error

When a `P-code` appears in the logs that isn't in the table:

1. Identify it (Prisma error reference, or read the cause).
2. Add **one line** to `TABLE`:
   ```ts
   P20XX: { status: 500, clientMessage: 'Something went wrong' },
   ```
3. Done — it now applies to the **whole app** automatically.

Nothing else changes: no service, no controller, no `main.ts`.

---

## 8. Recap

- Prisma **throws** the error and gives us a **code** — automatically.
- Nest **routes** it into our filter — automatically (global registration).
- We only **map the code** to a status + message — the single `TABLE`.
- Client gets a safe message; logs keep the truth.
- Services stay clean: `this.prisma.user.findMany()` and nothing else.
