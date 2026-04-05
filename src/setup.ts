import { bootstrapChannel } from './channel/init';
import { bootstrapCrawler, bootstrapCleanup } from './tools/rss-crawler/scheduler';
import { ARTICLE_EXPIRE_DAYS } from './utils/config';

export function bootstrap() {
  bootstrapChannel();
  bootstrapCrawler();
  bootstrapCleanup(ARTICLE_EXPIRE_DAYS);
  console.log('Agent 已经启动...');
}