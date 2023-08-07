import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import { PrismaService } from '../orm';

dayjs.extend(utc);

@Injectable()
export class CronJobsService {
  constructor(private readonly prismaService: PrismaService) {}

  @Cron('0 0 1 * *')
  async removeOldTokens() {
    const tokens = await this.prismaService.token.findMany();
    const currentDate = dayjs().utc();

    console.log('Current Date:', currentDate.toISOString());

    const tokensToDelete = tokens.filter((token) => {
      const createdAtDate = dayjs.utc(token.createdAt);
      return createdAtDate.isBefore(currentDate.subtract(1, 'month'));
    });

    if (tokensToDelete.length > 0) {
      await this.prismaService.token.deleteMany({
        where: { id: { in: tokensToDelete.map((token) => token.id) } },
      });
      console.log('Deleted Tokens:', tokensToDelete);
    }
    console.log('Cron started');
  }
}
