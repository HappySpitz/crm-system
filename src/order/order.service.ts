import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Comment, Group, Order } from '@prisma/client';
import { PrismaService, selectFieldsOfOrder } from '../core';
import { PaginateQuery } from 'nestjs-paginate';
import { AddCommentDto, CreateGroupDto, UpdateOrderDto } from './dto';
import { OrderEntity } from './order.entity';
import { EStatus, ICustomPaginated, IStatistic } from './interface';
import * as moment from 'moment';
import { isEmail } from 'class-validator';
import * as xlsx from 'xlsx';

@Injectable()
export class OrderService {
  constructor(private readonly prismaService: PrismaService) {}

  async getOrdersList(
    query?: PaginateQuery & { limit?: number}
  ): Promise<ICustomPaginated<OrderEntity>> {
    const { page = 1, limit = 25, sortBy = [['id', 'desc']], filter } = query;

    const skip = (page - 1) * limit;
    const take = limit;

    const orderBy =
      sortBy &&
      sortBy.map(([column, order]) => ({
        [column]: order === 'asc' ? 'asc' : 'desc',
      }));

    const where = {};
    if (filter && Object.keys(filter).length > 0) {
      Object.entries(filter).forEach(([key, value]) => {
        let startDate;
        let endDate;

        if (key === 'start_date') {
          startDate = Array.isArray(value) ? moment(value[0]) : moment(value);
        } else if (key === 'end_date') {
          endDate = Array.isArray(value) ? moment(value[0]) : moment(value);
        }

        if (startDate) {
          where['created_at'] = where['created_at'] || {};
          where['created_at'].gte = startDate.toISOString();
        }

        if (endDate) {
          where['created_at'] = where['created_at'] || {};
          where['created_at'].lte = endDate.toISOString();
        }

        if (
          key === 'name' ||
          key === 'surname' ||
          key === 'email' ||
          key === 'phone'
        ) {
          where[key] = { contains: value, mode: 'insensitive' };
        }

        if (
          key === 'course' ||
          key === 'course_type' ||
          key === 'course_format' ||
          key === 'status' ||
          key === 'group'
        ) {
          where[key] = { equals: value };
        }

        if (key === 'manager') {
          where[key] = {
            name: { equals: value },
          };
        }

        if (key === 'age') {
          if (Array.isArray(value)) {
            const ages = value.map((ageStr) => parseInt(ageStr, 10));
            if (ages.every((age) => typeof age === "number" && !isNaN(age))) {
              where[key] = {
                in: ages,
              };
            } else {
              throw new HttpException('Invalid age value', HttpStatus.BAD_REQUEST)
            }
          } else {
            const age = parseInt(value, 10);
            if (typeof age === "number" && !isNaN(age)) {
              where[key] = {
                equals: age,
              };
            } else {
              throw new HttpException('Invalid age value', HttpStatus.BAD_REQUEST)
            }
          }
        }
      });
    }

    const totalCount = await this.countOrders(where);

    const orders = await this.prismaService.order.findMany({
      select: selectFieldsOfOrder,
      skip,
      take,
      orderBy,
      where,
    });

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: orders,
      page,
      limit,
      totalCount,
      totalPages,
    };
  }

  async getOrdersListInExcel (query?: PaginateQuery) {
    const amountOfOrders = await this.countOrders();
    const { data } = await this.getOrdersList({...query, limit: amountOfOrders});

    const dataForExcel = data.map(item => ({
      id: item.id,
      name: item.name,
      surname: item.surname,
      email: item.email,
      phone: item.phone,
      age: item.age,
      course: item.course,
      course_format: item.course_format,
      course_type: item.course_type,
      sum: item.sum,
      already_paid: item.already_paid,
      created_at: item.created_at,
      utm: item.utm,
      msg: item.msg,
      status: item.status,
      group: item.group,
      manager: item.manager ? item.manager.name : null
    }));

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(dataForExcel);

    const columnAStyle = {
      font: { bold: true, sz: 14 },
      alignment: { vertical: 'center', horizontal: 'center' },
      fill: { fgColor: { rgb: '#FFFF00' } },
      border: {
        top: { style: 'thin', color: { rgb: '#000000' } },
        right: { style: 'thin', color: { rgb: '#000000' } },
        bottom: { style: 'thin', color: { rgb: '#000000' } },
        left: { style: 'thin', color: { rgb: '#000000' } },
      },
    };

    const rowCount = dataForExcel.length;

    const columnAStart = 1;
    const columnAEnd = rowCount;

    for (let row = columnAStart; row <= columnAEnd; row++) {
      const cellAddress = `A${row}`;
      worksheet[cellAddress] = {...worksheet[cellAddress], s: columnAStyle}
    }

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Orders');

    const fileName = `${new Date().toLocaleDateString()}.xlsx`;

    return xlsx.writeFile(workbook, fileName);
  }

  async getOrderById(orderId: string) {
    return this.prismaService.order.findFirst({
      where: { id: orderId },
      select: selectFieldsOfOrder,
    });
  }

  async getOrderByIdOrEmail(identifier: string): Promise<Order | null> {
    let order: Order | null = null;

    if (isEmail(identifier)) {
      order = await this.prismaService.order.findFirst({
        where: {
          email: identifier,
        },
      });
    } else {
      order = await this.prismaService.order.findFirst({
        where: {
          id: identifier,
        },
      });
    }

    return order;
  }

  async editOrderById(orderId: string, orderData: UpdateOrderDto, user: any) {
    const order = await this.getOrderByIdOrEmail(orderId);
    let group;

    if (orderData.group) {
      group = await this.checkGroup(orderData.group);
      if (!group) {
        throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
      }
    }

    if (order && (order.managerId === null || order.managerId === user.id)) {
      const updateData: UpdateOrderDto = {
        name: orderData.name,
        surname: orderData.surname,
        phone: orderData.phone,
        email: orderData.email,
        age: orderData.age,
        course: orderData.course,
        course_type: orderData.course_type,
        course_format: orderData.course_format,
        status: orderData.status,
        sum: orderData.sum,
        already_paid: orderData.already_paid,
        managerId: user.id,
      };

      if (group) {
        updateData.group = group.name;
      }

      return this.prismaService.order.update({
        where: { id: orderId },
        data: updateData,
        select: selectFieldsOfOrder,
      });
    } else {
      throw new HttpException(
        'You do not have permission to edit this order',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async addComment(
    orderId: string,
    data: AddCommentDto,
    user: any,
  ): Promise<Comment | HttpException> {
    const order = await this.checkOrder(orderId);

    if (order && (order.managerId === null || order.managerId === user.id)) {
      const comment = data.comment;

      if (order.status === EStatus.NEW || order.status === null) {
        await this.editOrderById(
          orderId,
          {
            status: EStatus.IN_WORK,
          },
          user,
        );
      }

      return this.prismaService.comment.create({
        data: {
          text: comment,
          orderId: order.id,
          author: `${user.name} ${user.surname}`,
          created_at: new Date(),
        },
      });
    }
    throw new HttpException('You can not add comment', HttpStatus.FORBIDDEN);
  }

  async checkOrder(orderId: string) {
    const order = await this.getOrderByIdOrEmail(orderId);

    if (!order) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    return order;
  }

  async createGroup(newGroup: CreateGroupDto): Promise<Group> {
    const group = await this.checkGroup(newGroup.name);

    if (!group) {
      return this.prismaService.group.create({
        data: {
          name: newGroup.name,
        },
      });
    }

    return group;
  }

  async checkGroup(nameGroup: string): Promise<Group> {
    const group = await this.prismaService.group.findFirst({
      where: { name: nameGroup },
    });

    if (!group) {
      return null;
    }

    return group;
  }

  async getCommentsFromOrderById(orderId: string): Promise<Comment[]> {
    return this.prismaService.comment.findMany({
      where: { orderId },
    });
  }

  async getGroups(): Promise<Group[]> {
    return this.prismaService.group.findMany();
  }

  async countOrders(argument?: Partial<Order>): Promise<number> {
    const where: any = argument ? { ...argument } : {};

    return this.prismaService.order.count({ where });
  }

  async getStatisticOnOrders(): Promise<IStatistic> {
    const total = await this.countOrders();
    const inWork = await this.countOrders({ status: EStatus.IN_WORK });
    const agree = await this.countOrders({ status: EStatus.AGREE });
    const disagree = await this.countOrders({ status: EStatus.DISAGREE });
    const dubbing = await this.countOrders({ status: EStatus.DUBBING });
    const newOrders = await this.countOrders({ status: EStatus.NEW && null });

    return {
      total,
      inWork,
      agree,
      disagree,
      dubbing,
      new: newOrders,
    };
  }

  async getOrdersFromManagerById(managerId: string) {
    return this.prismaService.order.findMany({
      where: { managerId },
      select: selectFieldsOfOrder,
    });
  }
}
