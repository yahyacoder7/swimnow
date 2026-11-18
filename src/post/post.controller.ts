import { Controller } from '@nestjs/common';
import { PostService } from './post.service';
import { Post } from '@nestjs/common';
import { Body } from '@nestjs/common';
import type { CreatePostDto } from './dto/create-post.dto';
import { CreatePostDtoSchema } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import {ZodValidationPipe} from '../common/pipes/zod-validation.pipe-';

@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

    @Post()
    async createPost(
      @Body(new ZodValidationPipe(CreatePostDtoSchema)) dto: CreatePostDto,) {
      return await this.postService.createPost(dto);
    }

    



  }

