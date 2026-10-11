# ID Strategy — Choosing Primary Keys

Notes on primary-key (ID) choice for SwimNow, and the reasoning behind the decision.
Sources: Supabase Postgres best-practices (`schema-primary-keys`) + Postgres docs.

---

## 1. What SwimNow uses today

```prisma
id String @id @default(cuid())
```

`id` is a **String (text)**, **not** a number. `cuid()` just generates a unique string value
like `cl9ebqhxk00008a9d8fm6dg2e`.

> A `cuid` is a **Collision-resistant Unique IDentifier** — a random-ish string, unique
> without needing the database to count `1, 2, 3…`.

---

## 2. Prisma's ID options

| `@default(...)` | Column type | Example value | Notes |
|---|---|---|---|
| `cuid()` | **String** | `cl9ebqhxk00008a9d8…` | roughly time-ordered, unique |
| `uuid()` | **String** | `550e8400-e29b-41d4-a716-446655440000` | random (v4) → fragmentation risk at scale |
| `ulid()` | **String** | `01ARZ3NDEKTSV4RRFFQ69G5FAV` | **time-sortable** |
| `nanoid()` | **String** | `V1StGXR8_Z5jdHi6B-myT` | short random |
| `autoincrement()` | **Int / BigInt** | `1, 2, 3, …` | database counter |

---

## 3. What the official Postgres guidance says

| Scenario | Recommended PK |
|---|---|
| **Single database** | `bigint identity` (sequential, 8 bytes, SQL-standard) |
| **Distributed / IDs exposed to users** | **UUIDv7 or ULID** (time-ordered strings) |
| ❌ Avoid | **random UUIDv4** as PK on large tables (index fragmentation) |

Key points:
- `bigint` is the textbook default **for a single database**.
- **Exposed** IDs (shown in URLs/APIs) → prefer **non-sequential** strings so they can't be guessed.
- Avoid **random** UUIDs as PKs when tables get large.

---

## 4. Performance difference (real, but scale-dependent)

| PK type | Size | Insert behavior | Index |
|---|---|---|---|
| `bigint` sequential | 8 B | appends at the end → fast | compact |
| UUIDv4 (random) | 16 B (36 as text) | scattered → page splits | bloated, ~2–4× |
| **UUIDv7 / ULID** (time-ordered) | 16 B / 26 B | appends like bigint | compact |
| `cuid` | ~25 B | roughly time-ordered | fine |

- At **small/medium scale** (thousands → millions of rows): the difference is **negligible**.
- It only matters at **100M+ rows** with **random** UUIDv4.

---

## 5. How companies decide — the actual criteria

1. **Single DB or distributed?** → single = `bigint`; distributed = `UUID` / `ULID`.
2. **Are IDs exposed in URLs/APIs?** → if yes, **sequential IDs are guessable**
   (`/users/1`, `/users/2` … → enumeration attacks). Prefer strings.
3. **Client-side / offline ID generation?** → UUID.
4. **Need time sorting?** → UUIDv7 / ULID / cuid.
5. **Merge data from multiple systems?** → UUID.

---

## 6. You are NOT trapped — decouple identity

A common professional pattern is to separate **two kinds of identity**:

| Kind | Purpose | Example |
|---|---|---|
| **Internal PK** | joins, performance | `bigint` |
| **Public ID** | what the API/URL shows | `uuid` |

Two columns, two jobs. So you never have to "convert string → bigint" later — you just **add**
a public ID if the need appears. Starting simple is safe.

Changing a PK type later is *possible* (a migration rewrites the table + all foreign keys), which
is exactly why the choice should be **deliberate up front** — not because you're stuck.

---

## 7. Decision for SwimNow

**Keep `String @id @default(cuid())`.**

Reasoning:
- SwimNow is a **single database** but its IDs are **exposed** in URLs → the "exposed IDs" rule applies.
- `cuid` is **non-guessable** → safe to expose (no enumeration).
- **JSON-safe** in NestJS (no `BigInt` serialization issues).
- **Standard** for Node/Prisma social apps.
- Roughly **time-ordered** → no fragmentation problem.

**When we'd switch to `bigint` instead:** if IDs became **internal-only** (never shown to users)
and we wanted maximum insert throughput at huge scale. Not the case here.

**If bigint is ever wanted anyway:**
- `Int @default(autoincrement())` → 32-bit, no BigInt JSON issue (caps at ~2.1B rows).
- `BigInt @id @default(autoincrement())` → 64-bit, but always **convert to string** in API responses.

---

## TL;DR

- Current id = **String (cuid)** — correct for an app whose IDs are shown in URLs.
- `bigint` is the default only for **internal, single-DB** IDs.
- Performance only differs meaningfully at **huge** scale with **random** UUIDs.
- You can **decouple** internal PK vs public ID later — no disaster, no lock-in.
- **SwimNow: keep `cuid`.** ✅
