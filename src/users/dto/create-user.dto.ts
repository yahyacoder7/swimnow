import { z } from 'zod';

export const CreateUserDtoSchema = z.object({
    firstName: z.string().min(1, { message: 'First name is required' }),
    lastName: z.string().min(1, { message: 'Last name is required' }),
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
    bio: z.string().optional(),



    /** Profile photo URL 
    profilePhoto: z.string().optional(), */
    /** Cover photo URL 
    coverPhoto: z.string().optional(),  */
})

export type createUserDto = z.infer<typeof CreateUserDtoSchema>;
