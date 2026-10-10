/*
  Warnings:

  - You are about to drop the column `reference_id` on the `notifications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "reference_id",
ADD COLUMN     "comment_id" TEXT,
ADD COLUMN     "friendship_id" TEXT,
ADD COLUMN     "message_id" TEXT,
ADD COLUMN     "post_id" TEXT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_friendship_id_fkey" FOREIGN KEY ("friendship_id") REFERENCES "friendships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
