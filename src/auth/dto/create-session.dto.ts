import { z} from 'zod';
    
export const CreateSessionDtoSchema = z.object({
    userId : z.string().cuid(),
});

export type CreateSessionDto = z.infer<typeof CreateSessionDtoSchema>;