import dotenv from 'dotenv';
import { bootstrapChannel } from './channel/init';
import { startCron } from './cron';
import { runAgent } from './agents/rss-agent';

dotenv.config();

export async function bootstrap() {
  bootstrapChannel();
  startCron();
  // runAgent();
  console.log('Agent 已经启动...');
}
