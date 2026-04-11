import dotenv from 'dotenv';
import { bootstrapChannel } from '@krobert/channel/init';
import { startCron } from '@krobert/cron';
import { runAgent } from '@krobert/agents/rss-agent/index';

dotenv.config();

export async function bootstrap() {
  bootstrapChannel(runAgent);
  startCron();
  // runAgent();
  console.log('Agent 已经启动...');
}
