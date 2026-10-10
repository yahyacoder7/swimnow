# Bugs

Issues found in `prisma/schema.prisma` (review of the L3PRO-based schema).

| # | Status | Bug |
|---|--------|-----|
| 1 | 🟢 Fixed | Friendship can be created twice (A→B and B→A) |
| 2 | 🟡 DB done, service pending | User can befriend / message themselves |
| 3 | 🟢 Fixed | Notifications dangle (`referenceId` has no FK) |
| 4 | 🔴 Open | Email is case-sensitive → duplicate accounts |
| 5 | 🟢 Fixed | Post could only hold **one** image |
| 6 | 🟢 Fixed | Empty posts allowed (no text) |
| 7 | 🟢 Fixed | No `Conversation` model → chat list awkward |
| 8 | ⚪ Optional | Notification spam (no dedupe) |

---

## 1. Friendship created twice
`@@unique([senderId, receiverId])` only blocks duplicates in the **same direction**.
A→B and B→A are different rows, so the same pair can have two friendships (and two "accepted").

## 2. Self-relationship allowed
Nothing stopped `senderId = receiverId` in `Friendship` and `Message`.
- **Friendship:** DB `CHECK` added (`friendships_no_self`).
- **Message:** now **conversation-based** (no `receiverId`), so messaging yourself is structurally impossible.

## 3. Notifications can dangle
`Notification.referenceId` is a plain string with **no foreign key**.
Deleting the related post/comment/message leaves the notification pointing at a dead id.

## 4. Email is case-sensitive
`A@x.com` and `a@x.com` create **two accounts** (Postgres `@unique` is case-sensitive).

## 5. Single image per post
`Post.image` was a single string → a post could hold **one** image only.

## 6. Empty posts allowed
`Post.content` was nullable → a post with **no text** (and no image) could be saved.

## 7. No conversation model
Messages only had `senderId` + `receiverId`; there was no `Conversation` to group a chat,
so the chat list and read/unread status were awkward to build.

## 8. Notification spam
No dedupe — repeated actions (like → unlike → like) create multiple notification rows.
The spec does **not** require fixing it → optional.

---

Fix: see `bugs-fixes.md`.
