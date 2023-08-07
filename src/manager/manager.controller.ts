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
import { ManagerService } from './manager.service';
import { CreateManagerDto, UpdateManagerDto } from './dto';
import { TrimPipe } from '../core';
import { AdminAuthGuard } from '../admin';
import { Paginate, PaginateQuery } from 'nestjs-paginate';

@ApiTags('Managers')
@Controller('managers')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class ManagerController {
  constructor(private readonly managerService: ManagerService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiQuery({
    name: 'page',
    type: Number,
    example: '1',
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
  async getManagersList(
    @Req() req: any,
    @Res() res: any,
    @Paginate() query?: PaginateQuery,
  ) {
    return res
      .status(HttpStatus.OK)
      .json(await this.managerService.getManagersList(query));
  }

  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiBody({ type: CreateManagerDto })
  @Post('create')
  async createManager(
    @Req() req: any,
    @Res() res: any,
    @Body(new TrimPipe()) body: CreateManagerDto,
  ) {
    return res
      .status(HttpStatus.OK)
      .json(await this.managerService.createManager(body));
  }

  @ApiParam({ name: 'managerId', required: true })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @Get(':managerId')
  async getOrderById(
    @Req() req: any,
    @Res() res: any,
    @Param('managerId') managerId: string,
  ) {
    return res
      .status(HttpStatus.OK)
      .json(await this.managerService.getManagerById(managerId));
  }

  @ApiParam({ name: 'managerId', required: true })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @Get(':managerId/statistic')
  async getStatisticOnManager(
    @Req() req: any,
    @Res() res: any,
    @Param('managerId') managerId: string,
  ) {
    return res
      .status(HttpStatus.OK)
      .json(await this.managerService.getStatisticOnManager(managerId));
  }

  @ApiParam({ name: 'managerId', required: true })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiBody({ type: UpdateManagerDto })
  @Patch(':managerId')
  async updateManager(
    @Req() req: any,
    @Res() res: any,
    @Body(new TrimPipe()) body: UpdateManagerDto,
    @Param('managerId') managerId: string,
  ) {
    return res
      .status(HttpStatus.OK)
      .json(await this.managerService.updateManager(managerId, body));
  }
}
