import {z} from 'zod';

export const UserLoginDtoSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export type UserLoginDto = z.infer<typeof UserLoginDtoSchema>;