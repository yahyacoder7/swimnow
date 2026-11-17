import { z } from 'zod';
import { CreatePostDtoSchema } from './create-post.dto';

export const UpdatePostDtoSchema = CreatePostDtoSchema.partial();
export type UpdatePostDto = z.infer<typeof UpdatePostDtoSchema>;
