# SQL Indexes — Learning Notes

A beginner-friendly explanation of what an index really is, and the part most people miss:
a **UNIQUE** index not only speeds up lookups — it **forbids duplicates**.

---

## 1. What an index is (the common understanding)

An index is a **separate data structure** the database keeps next to the table so it can find
rows quickly — like the index at the back of a book.

- **No index** → the DB reads *every* row to find a match (a "full table scan").
- **With index** → it jumps straight to the match.

So yes: the usual purpose of an index is **speed**.

```sql
CREATE INDEX "posts_user_idx" ON "posts" ("user_id");
```

That just makes "find all posts by user X" fast. Nothing more.

---

## 2. The part most people miss — `UNIQUE`

Add the word **`UNIQUE`** and the index gets a **second job**:

```sql
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");
```

Now the DB **refuses to insert two rows with the same email**. That's not about speed at all —
it's a **rule**.

| Kind | Speeds up search? | Forbids duplicates? |
|---|---|---|
| `CREATE INDEX` | ✅ | ❌ |
| `CREATE UNIQUE INDEX` | ✅ | ✅ |

> In PostgreSQL, a `UNIQUE` constraint **is** implemented as a unique index underneath.
> So "unique index" and "unique constraint" are effectively the same mechanism.

---

## 3. How a unique index actually catches duplicates

For each row, the index stores a **key**. On insert, the DB checks: *"does this key already exist?"*
If yes → **reject**.

Example with emails:

| Insert | key (`email`) | Already there? | Result |
|---|---|---|---|
| `a@x.com` | `a@x.com` | no | ✅ inserted |
| `a@x.com` | `a@x.com` | **yes** | ❌ rejected |

The key is just the column value(s) the index was built on.

---

## 4. The clever part — the key can be **computed**

The index doesn't have to use raw columns. It can use an **expression**, like `LEAST` / `GREATEST`:

```sql
CREATE UNIQUE INDEX "friendships_unique_pair"
  ON "friendships" (
    LEAST("sender_id", "receiver_id"),      -- the smaller id
    GREATEST("sender_id", "receiver_id")    -- the larger id
  );
```

`LEAST` = smaller, `GREATEST` = larger. So the **key** is always **(small first, large second)**,
**no matter who sent**.

Check the two directions:

| Row inserted | `LEAST` | `GREATEST` | key stored |
|---|---|---|---|
| `(7, 10)` | 7 | 10 | **(7, 10)** |
| `(10, 7)` | 7 | 10 | **(7, 10)** |

Both produce the **same key `(7, 10)`**. So:

- First insert → key `(7,10)` not present → ✅ inserted.
- Second insert → key `(7,10)` **already there** → ❌ rejected.

**This is the fix for Bug 1.** The unique index stops the duplicate because the *sorted pair* is
the same for both directions.

> Your intuition was right: whether you insert `7 then 10` **or** `10 then 7`, the index key is the
> same `(7, 10)` — so the second attempt is always seen as a duplicate and blocked. ✅

---

## 5. Why `LEAST` / `GREATEST` are needed

A plain `UNIQUE(sender_id, receiver_id)` uses the **raw order**:

| Row | raw unique key | Duplicate? |
|---|---|---|
| `(7, 10)` | `(7, 10)` | — |
| `(10, 7)` | `(10, 7)` | ❌ no (looks different!) |

Raw columns keep the direction, so the DB can't tell it's the same friendship.
`LEAST`/`GREATEST` **erase the direction** → both become `(7, 10)` → caught.

---

## 6. Mental model

- **Index** = a lookup table the DB keeps for speed. 📇
- **`UNIQUE` index** = that lookup table **plus** a rule: *"no two rows may share a key."* 🚫
- The key can be **raw columns** *or* a **computation** (`LEAST`/`GREATEST`, `LOWER(email)`, ...).

That's the whole concept: **an index is a key → row map; if it's UNIQUE, the DB also guarantees keys are distinct.**

---

## 7. Where this applies in SwimNow

| Problem | Unique key | Fix |
|---|---|---|
| Friendship duplicated (Bug 1) | `(LEAST(sender,receiver), GREATEST(sender,receiver))` | unique index on sorted pair |
| Email duplicates (Bug 4) | `LOWER(email)` | unique index on lowercased email |

Both are the **same idea**: build a unique index on the *normalized* value, so cosmetic differences
(direction, case) collapse to one key.
