import cron from 'node-cron';
import { runRssAgent } from '@krobert/agents';
import { logger, ACTIVE_CHANNELS } from '@krobert/utils';

const LARK_USER_OPEN_ID = process.env.LARK_USER_OPEN_ID;

export function bootstrapRssAnalysisCron() {
  logger.info('[Cron] Bootstrapping RSS Analysis daily task (Scheduled for 8:12 GMT+8)...');

  // 每天 UTC 00:12 执行
  cron.schedule(
    '12 8 * * *',
    async () => {
      logger.info('[Cron] Execution started: RSS Analysis (00:12 UTC)...');
      try {
        await runRssAgent('News', {
          chatId: LARK_USER_OPEN_ID,
          channels: [...ACTIVE_CHANNELS],
          receiveIdType: 'open_id',
        });
        logger.info('[Cron] Execution completed: RSS Analysis');
      } catch (error) {
        logger.error('[Cron] Error executing RSS Analysis:', error);
      }
    },
    { timezone: 'Asia/Shanghai' },
  );
}
