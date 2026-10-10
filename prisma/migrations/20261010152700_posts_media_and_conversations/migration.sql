/*
  Warnings:

  - You are about to drop the column `is_read` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `receiver_id` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `posts` table. All the data in the column will be lost.
  - Added the required column `conversation_id` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Made the column `content` on table `posts` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_receiver_id_fkey";

-- DropIndex
DROP INDEX "messages_receiver_id_is_read_idx";

-- DropIndex
DROP INDEX "messages_sender_id_receiver_id_created_at_idx";

-- DropConstraint
-- (obsolete raw CHECK added in the init migration; it references receiver_id,
--  so it MUST be dropped before the column is removed)
ALTER TABLE "messages" DROP CONSTRAINT "messages_no_self";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "is_read",
DROP COLUMN "receiver_id",
ADD COLUMN     "conversation_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "image",
ALTER COLUMN "content" SET NOT NULL;

-- CreateTable
CREATE TABLE "post_media" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_media_post_id_position_idx" ON "post_media"("post_id", "position");

-- CreateIndex
CREATE INDEX "conversation_participants_user_id_idx" ON "conversation_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "conversation_participants"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
