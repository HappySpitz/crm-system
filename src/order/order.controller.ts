import {
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { AddCommentDto, CreateGroupDto, UpdateOrderDto } from './dto';
import { Paginate, PaginateQuery } from 'nestjs-paginate';
import { AuthGuard } from '@nestjs/passport';
import { User } from '../auth/user.decorator';
import { TrimPipe } from '../core';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(AuthGuard('access'))
@ApiBearerAuth()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiQuery({
    name: 'page',
    type: Number,
    example: '4',
    required: false,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    example: '10',
    type: Number,
    required: false,
    description: 'Number of items per page',
  })
  @ApiQuery({
    name: 'sortBy',
    example: 'name:desc',
    type: String,
    required: false,
    description: 'Sort by column and order',
  })
  @ApiQuery({
    name: 'filter.name',
    example: 'max',
    type: String,
    required: false,
    description: 'Filter by value',
  })
  async getOrdersList(
    @Req() req: any,
    @Res() res: any,
    @Paginate() query?: PaginateQuery,
  ) {
    return res
      .status(HttpStatus.OK)
      .json(await this.orderService.getOrdersList(query));
  }

  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @Get('groups')
  async getGroups(@Req() req: any, @Res() res: any) {
    return res.status(HttpStatus.OK).json(await this.orderService.getGroups());
  }

  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @Get('statistic')
  async getStatisticOnOrders(@Req() req: any, @Res() res: any) {
    return res
      .status(HttpStatus.OK)
      .json(await this.orderService.getStatisticOnOrders());
  }

  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @Get('manager')
  async getOrdersFromManager(
    @Req() req: any,
    @Res() res: any,
    @User() user: any,
  ) {
    return res
      .status(HttpStatus.OK)
      .json(await this.orderService.getOrdersFromManagerById(user.id));
  }

  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiBody({ type: CreateGroupDto })
  @Post('create/group')
  async createGroup(
    @Req() req: any,
    @Body(new TrimPipe()) body: CreateGroupDto,
    @Res() res: any,
  ) {
    return res
      .status(HttpStatus.OK)
      .json(await this.orderService.createGroup(body));
  }

  @ApiParam({ name: 'orderId', required: true })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @Get(':orderId')
  async getOrderById(
    @Req() req: any,
    @Res() res: any,
    @Param('orderId') orderId: string,
  ) {
    return res
      .status(HttpStatus.OK)
      .json(await this.orderService.getOrderById(orderId));
  }

  @ApiParam({ name: 'orderId', required: true })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @Patch(':orderId')
  async editOrder(
    @Req() req: any,
    @Body(new TrimPipe()) body: UpdateOrderDto,
    @Res() res: any,
    @Param('orderId') orderId: string,
    @User() user: any,
  ) {
    return res
      .status(HttpStatus.OK)
      .json(await this.orderService.editOrderById(orderId, body, user.id));
  }

  @ApiParam({ name: 'orderId', required: true })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiBody({ type: AddCommentDto })
  @Post(':orderId/comment')
  async addComment(
    @Req() req: any,
    @Body(new TrimPipe()) body: AddCommentDto,
    @Res() res: any,
    @Param('orderId') orderId: string,
    @User() user: any,
  ) {
    return res
      .status(HttpStatus.OK)
      .json(await this.orderService.addComment(orderId, body, user));
  }

  @ApiParam({ name: 'orderId', required: true })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @Get(':orderId/comments')
  async getCommentsFromOrderById(
    @Req() req: any,
    @Res() res: any,
    @Param('orderId') orderId: string,
  ) {
    return res
      .status(HttpStatus.OK)
      .json(await this.orderService.getCommentsFromOrderById(orderId));
  }
}
