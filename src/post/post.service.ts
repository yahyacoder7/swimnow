import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
@Injectable()
export class PostService {
  constructor(private prisma: PrismaService) {}

  async createPost(dto: CreatePostDto){

    const post = await this.prisma.post.create({
        data: dto,
    });
    return post;
  }
}
