import dotenv from 'dotenv';
import { bootstrapChannel } from '@krobert/channel/init';
import { startCron } from '@krobert/cron';
import { runAgent } from '@krobert/agents/rss-agent/index';
import { runAgent as runWeatherAgent } from '@krobert/agents/weather-agent/index';
import { logger } from '@krobert/utils';

dotenv.config();

export async function bootstrap() {
  bootstrapChannel();
  // startCron();

  logger.info('[Bot] Agent 已经启动...');
}
