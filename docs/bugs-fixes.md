# Bug Fixes

## Bug 1 — Friendship created twice

**Cause**
`@@unique([senderId, receiverId])` compares the *direction*, so `(A→B)` and `(B→A)` are stored as two different rows → duplicates.

**Core idea (both options below)**
A friendship is an **unordered pair** `{A, B}`. But rows are ordered, so `(A,B)` and `(B,A)` *look* different.
Fix: make both directions produce the **same key** — by always putting the **smaller id first** and the **larger id second**. Then a unique constraint finally catches the duplicate.

Two ways to do it — pick **one**:

---

### Option A — Keep `senderId` / `receiverId` + raw SQL (DB does the sorting)

No column changes. The unique index is computed on the **sorted pair** using `LEAST` (smaller) / `GREATEST` (larger).

Append to the migration SQL:
```sql
CREATE UNIQUE INDEX "friendships_unique_pair"
  ON "friendships" (
    LEAST("sender_id", "receiver_id"),
    GREATEST("sender_id", "receiver_id")
  );
```

How it works:
| stored row | LEAST | GREATEST | index key |
|---|---|---|---|
| (42, 7) | 7 | 42 | **(7, 42)** |
| (7, 42) | 7 | 42 | **(7, 42)** ← same key → rejected |

✅ Keeps the PDF columns, DB handles it alone. ❌ Needs raw SQL.

---

### Option B — Canonical columns `userAId` / `userBId` (pure Prisma)

Rename the columns so the pair is always stored sorted, then a normal `@@unique` works. **No raw SQL.**

```prisma
model Friendship {
  id          String           @id @default(cuid())
  userAId     String           @map("user_a_id")    // smaller of the two ids
  userBId     String           @map("user_b_id")    // larger of the two ids
  requesterId String           @map("requester_id") // who sent the request
  status      FriendshipStatus @default(PENDING)
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")

  userA     User @relation("FriendshipUserA", fields: [userAId], references: [id], onDelete: Cascade)
  userB     User @relation("FriendshipUserB", fields: [userBId], references: [id], onDelete: Cascade)
  requester User @relation("FriendshipRequester", fields: [requesterId], references: [id], onDelete: Cascade)

  @@unique([userAId, userBId])
  @@index([userAId, status])
  @@index([userBId, status])
  @@map("friendships")
}
```

Also update the `User` relations (replace `sentFriendships` / `receivedFriendships`):
```prisma
friendshipsAsA      Friendship[] @relation("FriendshipUserA")
friendshipsAsB      Friendship[] @relation("FriendshipUserB")
friendshipsRequested Friendship[] @relation("FriendshipRequester")
```

✅ Pure Prisma, no raw SQL. ❌ Renames columns, service must sort.

---

### Service rule (needed in BOTH options — for a clean error)

```ts
// 1. reject self
if (id1 === id2) throw new Error("Cannot befriend yourself");

// 2. canonical pair (only Option B stores it; Option A still sorts to look up)
const [userAId, userBId] = [id1, id2].sort();

// 3. one row per pair — don't insert if it exists
const existing = await prisma.friendship.findUnique({
  where: { userAId_userBId: { userAId, userBId } }, // Option B
  // Option A: where: { OR: [{ senderId: id1, receiverId: id2 }, { senderId: id2, receiverId: id1 }] }
});
if (existing) throw new Error("Friendship already exists");

// 4. insert (requesterId = the actual sender)
await prisma.friendship.create({
  data: { userAId, userBId, requesterId: id1, status: "PENDING" }, // Option B
  // Option A: data: { senderId: id1, receiverId: id2, status: "PENDING" }
});
```

**On rejection:** reuse the same row — set `status = PENDING` and update `requesterId` (never insert a new row).

**Result:** the DB guarantees one friendship per pair; the service check only gives a clean error message.
**DB = guarantee, service = nice error. Do both.**

---

## Bug 2 — Self-relationship allowed

**Cause**
Nothing stops `senderId = receiverId`, so a user can befriend or message themselves.

**Fix — two layers**

1. **Service** (required): reject when both ids are the same.
```ts
if (senderId === receiverId) throw new Error("You cannot add/message yourself");
```

2. **DB** (safety net) — add to the migration SQL:
```sql
ALTER TABLE "friendships"
  ADD CONSTRAINT "friendships_no_self" CHECK ("sender_id" <> "receiver_id");

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_no_self" CHECK ("sender_id" <> "receiver_id");
```

> Note: with the canonical-pair model (Bug 1), `Friendship` uses `user_a_id` / `user_b_id`,
> so the check becomes `CHECK ("user_a_id" <> "user_b_id")`. For `Friendship` the service
> self-check is already covered by requiring `userAId <> userBId`.

**Result:** users can never add or message themselves; the DB refuses it even if the service is bypassed.

---

## Bug 3 — Notifications dangle (`referenceId` had no FK)

**Cause**
`Notification.referenceId` was a **loose string with no foreign key**. It pointed at different
tables depending on `type` (friendships, messages, posts, comments). Since one column can't
reference many tables, nothing enforced it → deleting the target left the notification pointing
at a **dead id**.

**Decision:** **Option A — typed nullable FKs** (DB-enforced), **no raw SQL**.

**Schema change**
```prisma
model Notification {
  id        String           @id @default(cuid())
  userId    String           @map("user_id") // recipient
  type      NotificationType
  isRead    Boolean          @default(false) @map("is_read")
  createdAt DateTime         @default(now()) @map("created_at")

  postId       String? @map("post_id")
  commentId    String? @map("comment_id")
  messageId    String? @map("message_id")
  friendshipId String? @map("friendship_id")

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  post       Post?       @relation(fields: [postId], references: [id], onDelete: Cascade)
  comment    Comment?    @relation(fields: [commentId], references: [id], onDelete: Cascade)
  message    Message?    @relation(fields: [messageId], references: [id], onDelete: Cascade)
  friendship Friendship? @relation(fields: [friendshipId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@map("notifications")
}
```

Also add a reverse relation to each target model:
```prisma
// in Post, Comment, Message, Friendship:
notifications Notification[]
```

**Migration:** generated automatically by Prisma (`notification_typed_fks`), no hand-written SQL.
Each FK uses `ON DELETE CASCADE`, so deleting the target row deletes its notifications.

**Service rule** — set the matching column based on `type`:
```ts
await prisma.notification.create({
  data: {
    userId: recipientId,
    type: "POST_LIKE",
    postId, // ← the only target set for this type; others stay null
  },
});
```

**Type → column map**
| `type` | column |
|---|---|
| `FRIEND_REQUEST`, `FRIEND_ACCEPTED` | `friendshipId` |
| `NEW_MESSAGE` | `messageId` |
| `POST_LIKE`, `POST_DISLIKE`, `POST_COMMENT` | `postId` |
| `COMMENT_LIKE`, `COMMENT_DISLIKE` | `commentId` |

**Result:** no dangling notifications — the DB cascades deletes, so a notification can never point
at a row that no longer exists.

---

## Bug 5 — One image per post → multiple images

**Cause**
`Post.image` was a single string → only one image per post.

**Fix:** a **`PostMedia`** table (one row per image) and drop `Post.image`.

```prisma
model Post {
  // ...
  content String @db.Text
  media   PostMedia[]      // ← was: image String?
  // ...
}

model PostMedia {
  id        String   @id @default(cuid())
  postId    String   @map("post_id")
  key       String                       // MinIO object key
  position  Int      @default(0)         // display order
  createdAt DateTime @default(now()) @map("created_at")

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([postId, position])
  @@map("post_media")
}
```

**Service rule**
- Create the post, then insert its images in the **same transaction**.
- Set `position = 0,1,2…` for order.

**Note:** exceeds the spec (which says a single image) but is a **superset** — still passes
"upload an image with a post".

---

## Bug 6 — Text required (no empty posts)

**Cause**
`Post.content` was nullable → a post with no text could be saved.

**Fix**
```prisma
content String @db.Text   // remove the "?" → NOT NULL
```
Now the DB rejects a post with `NULL` content, so an empty post is impossible.

**Note:** the spec allows **image-only** posts. Requiring text **deviates** from the spec —
a deliberate choice for this project.

---

## Bug 7 — Conversations (normalized, 3 tables)

**Cause**
`Message` only had `senderId` + `receiverId`. There was no `Conversation`, so listing chats and
tracking read/unread was awkward.

**Fix:** three tables in the messaging domain.

```prisma
model Conversation {
  id            String    @id @default(cuid())
  createdAt     DateTime  @default(now()) @map("created_at")
  lastMessageAt DateTime? @map("last_message_at") // for sorting the chat list

  participants ConversationParticipant[]
  messages     Message[]

  @@map("conversations")
}

model ConversationParticipant {
  id             String    @id @default(cuid())
  conversationId String    @map("conversation_id")
  userId         String    @map("user_id")
  lastReadAt     DateTime? @map("last_read_at") // unread = messages after this
  createdAt      DateTime  @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([conversationId, userId])
  @@index([userId])
  @@map("conversation_participants")
}

model Message {
  id             String   @id @default(cuid())
  conversationId String   @map("conversation_id") // ← was: receiverId + isRead
  senderId       String   @map("sender_id")
  content        String   @db.Text
  createdAt      DateTime @default(now()) @map("created_at")

  conversation  Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender        User         @relation("MessageSender", fields: [senderId], references: [id], onDelete: Cascade)
  notifications Notification[]

  @@index([conversationId, createdAt])
  @@map("messages")
}
```

**Flow (send a message)**
1. **Find-or-create** the conversation between the two users.
2. Insert the message with its `conversationId`.
3. Set `conversation.lastMessageAt = now()`.

**Read / unread**
- Mark read: `ConversationParticipant.lastReadAt = now()`.
- Unread count: messages where `created_at > lastReadAt` for that participant.

**Chat list** (clean, sorted):
```sql
SELECT c.id, c.last_message_at
FROM conversations c
JOIN conversation_participants p ON p.conversation_id = c.id
WHERE p.user_id = $1
ORDER BY c.last_message_at DESC;
```

**Migration lesson (important)**
The init migration had a raw CHECK `messages_no_self CHECK (sender_id <> receiver_id)`.
Because we **dropped `receiver_id`**, the new migration had to **drop that constraint first**,
or Postgres refuses to drop the column:
```sql
ALTER TABLE "messages" DROP CONSTRAINT "messages_no_self";
```
This is the pattern: when a schema change touches a column that a **hand-written** constraint
depends on, add the `DROP CONSTRAINT` to the new migration.

---

## Bug 8 — Notification spam (optional)

**Cause**
No dedupe → like → unlike → like creates **multiple** notification rows.

**Fix (if desired)** — dedupe at **insert time**:
- Add a unique key on `(userId, type, target)`.
- **Upsert**: repeated events update the existing row (bump `createdAt`, reset `isRead`) instead of
  inserting a new one.

**Status:** not required by the spec → optional polish.
