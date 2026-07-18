import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { MYDATA_NIGHTLY_SYNC_JOB, MYDATA_SYNC_QUEUE } from './mydata-sync.queue';
import { MyDataService } from './mydata.service';

@Processor(MYDATA_SYNC_QUEUE, { concurrency: 1 })
export class MyDataSyncProcessor extends WorkerHost {
  constructor(
    private readonly myDataService: MyDataService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name !== MYDATA_NIGHTLY_SYNC_JOB) {
      throw new Error('Unsupported myDATA background job: ' + job.name);
    }
    const maxPages = this.configService.get<number>('MYDATA_SCHEDULED_SYNC_MAX_PAGES', 10);
    return this.myDataService.syncScheduledOffices(maxPages);
  }
}
