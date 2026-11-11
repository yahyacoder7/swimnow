import { PartialType } from '@nestjs/mapped-types';
import { createUserDto } from './create-user.dto';
import { z } from 'zod';
import { CreateUserDtoSchema } from './create-user.dto';

export const UpdateUserDtoSchema = CreateUserDtoSchema.partial();
export type UpdateUserDto = z.infer<typeof UpdateUserDtoSchema>;
