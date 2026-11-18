import { z } from 'zod';
import { CreatePostDtoSchema } from './create-post.dto';

export const UpdatePostDtoSchema = CreatePostDtoSchema.omit({
  userId: true,
}).partial();
export type UpdatePostDto = z.infer<typeof UpdatePostDtoSchema>;
