import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
  
  async create(createUser: CreateUserDto) {
    const data = createUser;
    const user = await this.prisma.user.create({
      data: data,
    });
    return user;
  }

  findAll() {
    const users = this.prisma.user.findMany();
    return users;
  }

  async findOne(id: string) {

  const user = await this.prisma.user.findUnique({
      where: {
        id: id,
      },
    });
    console.log('user:', user);
    return user;
  }
  update(id: string, updateUser: UpdateUserDto) {
    if(updateUser == null){
      throw new Error('updateUser is null');
    }
   const user = this.prisma.user.update({
      where: {
       id: id,
      },
      data: updateUser,
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
