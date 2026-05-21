import dotenv from 'dotenv';
import { bootstrapChannel } from '@krobert/channel/init';
import { startCron } from '@krobert/cron';
import { logger } from '@krobert/utils';
import { resolve } from 'path';
import { registerTelegramCommandEventHandlers } from './telegram-command-events';

const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';

dotenv.config({ path: resolve(process.cwd(), envFile), override: true });

export async function bootstrap() {
  registerTelegramCommandEventHandlers();
  bootstrapChannel();
  startCron();

  logger.info('[Bot] Agent 已经启动...');
}
