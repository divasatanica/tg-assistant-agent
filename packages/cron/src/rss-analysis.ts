import cron from 'node-cron';
import { runAgent } from '@krobert/agents/rss-agent/index';
import { logger } from '@krobert/utils';

export function bootstrapRssAnalysisCron() {
  logger.info('[Cron] Bootstrapping RSS Analysis daily task (Scheduled for 8:00 AM)...');

  // 每天上午 8:00 执行
  cron.schedule('0 8 * * *', async () => {
    logger.info('[Cron] Execution started: RSS Analysis (8 AM)...');
    try {
      await runAgent(['News']);
      logger.info('[Cron] Execution completed: RSS Analysis');
    } catch (error) {
      logger.error('[Cron] Error executing RSS Analysis:', error);
    }
  });
}
