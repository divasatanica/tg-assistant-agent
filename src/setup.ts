import { bootstrapChannel } from './channel/init';

export function bootstrap() {
  bootstrapChannel();
  console.log('Agent 已经启动...');
}