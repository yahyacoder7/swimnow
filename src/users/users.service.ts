import { Injectable } from '@nestjs/common';
import { createUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
  async create(createUserDto: createUserDto) {
    const data = createUserDto;
    const user = await this.prisma.user.create({
      data: data,
    });
  }

  findAll() {
    const users = this.prisma.user.findMany();
    return users;
  }

  findOne(id: string) {

  const user = this.prisma.user.findUnique({
      where: {
        id: id,
      },
    });
    return user;
  }
  update(id: string, updateUserDto: UpdateUserDto) {
   const user = this.prisma.user.update({
      where: {
        id: id,
      },
      data: updateUserDto,
    });
    return user;
  }

  remove(id: string) {
  const user = this.prisma.user.delete({
      where: {
        id: id,
      },
    });
    return user;
  }
}
