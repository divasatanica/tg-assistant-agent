import cron from 'node-cron';
import { runAgent } from '@/agents/rss-agent/index';

export function bootstrapRssAnalysisCron() {
  console.log('[Cron] Bootstrapping RSS Analysis daily task (Scheduled for 8:00 AM)...');

  // 每天上午 8:00 执行
  cron.schedule('0 8 * * *', async () => {
    console.log('[Cron] Execution started: RSS Analysis (8 AM)...');
    try {
      await runAgent(['News']);
      console.log('[Cron] Execution completed: RSS Analysis');
    } catch (error) {
      console.error('[Cron] Error executing RSS Analysis:', error);
    }
  });
}
