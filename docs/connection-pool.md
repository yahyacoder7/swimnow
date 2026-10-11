# Connection Pool — concept & how to handle it

A **connection pool** is a set of **already-open** Postgres connections that
requests **borrow** and **return**. It's the standard way to talk to Postgres
from an app, and it's what `@prisma/adapter-pg` gives us.

---

## Why do we need a pool?

Opening a Postgres connection is **expensive**:

- TCP handshake + authentication + a new backend process on the server side
- each connection costs roughy **5–15 MB** of server RAM
- the handshake takes tens of milliseconds

Doing that **per request** would kill an app. A pool keeps a small, fixed set of
connections alive and reuses them:

```
Request ──► borrow ──► [ pool: conn1 conn2 conn3 ] ──► Postgres
                 ◄── return ◄──────────────────────
```

- Pool exhausted? The request **waits** (up to a timeout).
- Idle too long? The connection is **closed** (`idleTimeoutMillis`).

Analogy: a taxi rank. You don't buy a car per passenger — you keep N taxis and
reuse them.

---

## Your stack: Prisma 7 + `PrismaPg`

Prisma 7 has no built-in engine anymore — it needs a **driver adapter**.
`@prisma/adapter-pg` wraps a **node-postgres `pg.Pool`**, so all pool options
are `pg.PoolConfig`:

```ts
super({
  adapter: new PrismaPg({
    connectionString,
    max: 10,                        // max connections this process uses
    idleTimeoutMillis: 30_000,      // close idle connections after 30s
    connectionTimeoutMillis: 5_000, // fail fast if pool is exhausted
  }),
});
```

| Option | Meaning |
|---|---|
| `max` | pool size — how many open connections this app instance may use |
| `idleTimeoutMillis` | how long an unused connection lives before closing (**this prevents "leaving things open"**) |
| `connectionTimeoutMillis` | give up waiting for a free connection after N ms instead of hanging |

Defaults (pg): `max = 10`, `idleTimeoutMillis = 10000`, `connectionTimeoutMillis = 0` (no timeout).

---

## How to decide the pool size — one hard rule

Postgres has a **hard cap**:

```sql
SHOW max_connections;                    -- default 100
SHOW superuser_reserved_connections;     -- default 3
```

You must respect:

```
pool_max × number_of_app_instances  ≤  max_connections − reserved
```

So:

```
pool_max = floor( (max_connections − reserved) / instances )
```

Sizing examples (Postgres default `max_connections = 100`, reserved 3):

| App instances | Safe `max` per instance |
|---|---|
| 1 (dev / small project) | 10 (or up to ~90, but no need) |
| 2 | ~48 |
| 4 | ~24 |
| 10 | ~9 |

---

## Rules of thumb

1. **Start small.** `max: 10` is plenty for a school project and moderate load.
2. **Bigger ≠ better.** Too many connections → slow Postgres (context switching)
   or `FATAL: sorry, too many clients`.
3. **Always leave headroom** for `psql`, migrations, admin tools.
4. **Scale by instances, not pool size.** More replicas → smaller `max` each,
   so the total stays under `max_connections`.
5. **If connections are mostly idle**, lower `max` or shorten
   `idleTimeoutMillis` — don't hold connections doing nothing.

---

## Monitoring

Seen in action / diagnose problems:

```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'swimnow';

SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
```

Check the server cap:

```bash
docker exec swimnow-postgres psql -U <POSTGRES_USER> -d swimnow -c 'SHOW max_connections;'
```

---

## Many instances / serverless

With many replicas (or serverless), per-process pools multiply and blow the
cap. Solution: put **PgBouncer** between the app and Postgres — one shared pool
for everyone — and keep each app's `max` low.

---

## Recommended config for SwimNow

Make it env-driven (so it's tunable without touching code), `.env`:

```
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=5000
```

Read them in `PrismaService` with `ConfigService` and pass to `PrismaPg`.
Defaults: `max 10`, idle 30s, connect-timeout 5s.