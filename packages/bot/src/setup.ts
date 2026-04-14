import dotenv from 'dotenv';
import { bootstrapChannel } from '@krobert/channel/init';
import { startCron } from '@krobert/cron';
import { logger, TG_BOT_TOKEN } from '@krobert/utils';
import { resolve } from 'path';

const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';

dotenv.config({ path: resolve(process.cwd(), envFile), override: true });

console.log('process.env.TG_BOT_TOKEN', process.env.TG_BOT_TOKEN, TG_BOT_TOKEN);

export async function bootstrap() {
  bootstrapChannel();
  startCron();

  logger.info('[Bot] Agent 已经启动...');
}
