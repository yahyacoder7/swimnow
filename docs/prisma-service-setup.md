# PrismaService setup — bugs, why, and how to fix

These are the problems hit while wiring Prisma 7 into NestJS, with the reason
and the fix. Code lives in `src/prisma/`.

---

## 1. Prisma 7 needs a driver adapter

**Why it breaks:** Prisma 7 removed the built-in query engine. Calling
`new PrismaClient()` with no adapter throws at startup.

**How to fix:** install a driver adapter and pass it in `super(...)`:
```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

super({ adapter: new PrismaPg({ connectionString }) });
```
Deps: `@prisma/adapter-pg` + `pg`.

---

## 2. Generated client outside `rootDir` — `TS6059`

**Why it breaks:** `tsconfig.build.json` sets `rootDir: "./src"` and
`include: ["src"]`, but the generator wrote the client to `../generated/prisma`
(project root). TypeScript refuses: *"File is not under 'rootDir'"*.

**How to fix:** generate the client **inside** `src`:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"   // was ../generated/prisma
}
```
Then:
- import from `../generated/prisma/client`
- `.gitignore`: `/generated/prisma` → `/src/generated/prisma`
- `pnpm exec prisma generate`

---

## 3. `.env` not loaded at runtime

**Why it breaks:** `prisma7.config.ts` loads dotenv for the **Prisma CLI only**.
The Nest app never reads `.env`, so `DATABASE_URL` is `undefined` and the
adapter can't connect.

**How to fix:** load env in the app:
```ts
ConfigModule.forRoot({ isGlobal: true })   // @nestjs/config
```
Then read it with `config.getOrThrow<string>('DATABASE_URL')`.
Zero-dependency alternative (Node 24): `process.loadEnvFile()` at the top of `main.ts`.

---

## 4. `nest g resource prisma` produced broken/extra files

**Why it breaks:** the generator creates a controller + service + module +
specs. The stub had typos (`onModuleUnit`, `implements {}`), a wrong import
path, and a nested `src/prisma/prisma/` folder. A Prisma module needs **no
controller** (it has no routes).

**How to fix:**
- delete `prisma.controller.ts` and the `*.spec.ts` stubs
- flatten to `src/prisma/prisma.service.ts` + `src/prisma/prisma.module.ts`
- mark the module `@Global()` so features can inject `PrismaService` anywhere:
```ts
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

---

## Where things stand now
```
src/
├── app.module.ts                 # ConfigModule.forRoot() + PrismaModule
├── main.ts
└── prisma/
    ├── prisma.module.ts          # @Global, exports PrismaService
    └── prisma.service.ts         # extends PrismaClient (PrismaPg adapter)
```
Verified: `pnpm build` ✅ and the app boots + `$connect()` to Postgres ✅.

---

## The database bugs (separate)
The 8 data-model bugs (duplicate friendship, self-relationships, dangling
notifications, email case, single image, empty posts, conversations,
notification dedupe) are tracked in `bugs.md` and explained — **why + how to
fix** — in `bugs-fixes.md`.
