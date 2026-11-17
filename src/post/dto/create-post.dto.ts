import { z } from 'zod';

export const CreatePostDtoSchema = z.object({
    userId: z.string().min(1, { message: 'User ID is required' }),
    content: z.string().min(1, { message: 'Content is required' }),
});

export type CreatePostDto = z.infer<typeof CreatePostDtoSchema>;
