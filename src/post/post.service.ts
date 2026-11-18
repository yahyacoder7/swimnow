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

  async updatePost(id: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.update({
        where: { id },
        data: dto,
    });
    return post;
  }

  async getPostById(id: string) {
    const post = await this.prisma.post.findUnique({
        where: { id},
        
    });
    return post;
  }
}
