import {
  ArgumentMetadata, // type: { type, metatype, data } — where the value came from
  BadRequestException, // class: throws HTTP 400 with a JSON body
  Body, // factory: @Body() → ParameterDecorator (we wrap it)
  PipeTransform, // interface: requires transform(value, metadata)
} from '@nestjs/common';

import { ZodType } from 'zod'; // type: any Zod schema (the rules object)

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: any) {
    const result = this.schema.safeParse(value);
    /**
 // عند النجاح
{ success: true, data: { name: 'Ali', age: 20 } }

// عند الفشل
{ success: false, error: ZodError }
 */
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return result.data;
  }
}
