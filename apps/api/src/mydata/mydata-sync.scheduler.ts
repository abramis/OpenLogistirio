import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { MYDATA_NIGHTLY_SYNC_JOB, MYDATA_SYNC_QUEUE } from './mydata-sync.queue';

@Injectable()
export class MyDataSyncScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(MYDATA_SYNC_QUEUE) private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.configService.get<boolean>('MYDATA_SCHEDULED_SYNC_ENABLED', false)) return;

    const pattern = this.configService.get<string>(
      'MYDATA_SCHEDULED_SYNC_CRON',
      '0 2 * * *',
    );
    await this.queue.upsertJobScheduler(
      MYDATA_NIGHTLY_SYNC_JOB,
      { pattern, tz: 'Europe/Athens' },
      {
        name: MYDATA_NIGHTLY_SYNC_JOB,
        data: {},
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 30,
          removeOnFail: 100,
        },
      },
    );
  }
}
