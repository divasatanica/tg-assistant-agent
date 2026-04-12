import dotenv from 'dotenv';
import { bootstrapChannel } from '@krobert/channel/init';
import { startCron } from '@krobert/cron';
import { logger } from '@krobert/utils';

dotenv.config();

export async function bootstrap() {
  bootstrapChannel();
  startCron();

  logger.info('[Bot] Agent 已经启动...');
}
