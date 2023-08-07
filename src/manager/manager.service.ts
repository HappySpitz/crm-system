import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PasswordService, PrismaService, selectFieldsOfManager } from '../core';
import { CreateManagerDto, UpdateManagerDto } from './dto';
import { IManager, IStatistic } from './interface';
import { isEmail } from 'class-validator';
import { EStatus, ICustomPaginated, OrderService } from '../order';
import { User } from '@prisma/client';
import { PaginateQuery } from 'nestjs-paginate';

@Injectable()
export class ManagerService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly orderService: OrderService,
  ) {}

  async getManagersList(
    query?: PaginateQuery,
  ): Promise<ICustomPaginated<IManager>> {
    const { page = 1, limit = 10 } = query;

    const skip = (page - 1) * limit;
    const take = limit;

    const totalCount = await this.prismaService.user.count({
      where: { role: 'manager' },
    });

    const managers = await this.prismaService.user.findMany({
      select: selectFieldsOfManager,
      skip,
      take,
      where: { role: { equals: 'manager' } },
    });

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: managers,
      page,
      limit,
      totalCount,
      totalPages,
    };
  }

  async getManagerById(id: string): Promise<IManager> {
    const user = await this.prismaService.user.findFirst({
      where: {
        id,
      },
      select: selectFieldsOfManager,
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    return user;
  }

  async getManagerByIdOrEmail(identifier: string): Promise<User | null> {
    let manager: User | null = null;

    if (isEmail(identifier)) {
      manager = await this.prismaService.user.findFirst({
        where: {
          email: identifier,
        },
      });
    } else {
      manager = await this.prismaService.user.findFirst({
        where: {
          id: identifier,
        },
      });
    }

    return manager;
  }

  async createManager(manager: CreateManagerDto): Promise<IManager> {
    if (await this.getManagerByIdOrEmail(manager.email)) {
      throw new HttpException(
        'Email is already in use.',
        HttpStatus.BAD_REQUEST,
      );
    } else {
      return this.prismaService.user.create({
        data: {
          name: manager.name,
          surname: manager.surname,
          email: manager.email.toLowerCase(),
        },
        select: selectFieldsOfManager,
      });
    }
  }

  async updateManager(
    managerId: string,
    managerData: UpdateManagerDto,
  ): Promise<IManager> {
    let password;

    if (managerData.password) {
      password = await this.passwordService.hashPassword(managerData.password);
    }

    const updateData: UpdateManagerDto = {
      name: managerData.name,
      surname: managerData.surname,
      email: managerData.email,
      status: managerData.status,
      is_active: managerData.is_active,
      last_login: managerData.last_login,
    };

    if (password) {
      updateData.password = password;
    }

    return this.prismaService.user.update({
      where: { id: managerId },
      data: updateData,
      select: selectFieldsOfManager,
    });
  }

  async countOrdersForManager(id: string, status?: string): Promise<number> {
    return this.orderService.countOrders({ managerId: id, status });
  }

  async getStatisticOnManager(managerId: string): Promise<IStatistic> {
    const manager = await this.getManagerByIdOrEmail(managerId);

    if (!manager) {
      throw new HttpException('Manager not found', HttpStatus.NOT_FOUND);
    }

    const ordersWithManager = await this.countOrdersForManager(managerId);
    const inWorkOrdersWithManager = await this.countOrdersForManager(
      managerId,
      EStatus.IN_WORK,
    );
    const dubbingOrdersWithManager = await this.countOrdersForManager(
      managerId,
      EStatus.DUBBING,
    );
    const agreeOrdersWithManager = await this.countOrdersForManager(
      managerId,
      EStatus.AGREE,
    );
    const disagreeOrdersWithManager = await this.countOrdersForManager(
      managerId,
      EStatus.DISAGREE,
    );

    return {
      total: ordersWithManager,
      inWork: inWorkOrdersWithManager,
      agree: agreeOrdersWithManager,
      disagree: disagreeOrdersWithManager,
      dubbing: dubbingOrdersWithManager,
    };
  }
}
