import cron from 'node-cron';
import { runAgent } from '@krobert/agents/sec-filing-agent/index';
import { logger } from '@krobert/utils';

const WATCHLIST_TICKERS = (process.env.SEC_WATCHLIST_TICKERS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function bootstrapSecFilingCron() {
  if (WATCHLIST_TICKERS.length === 0) {
    logger.warn('[Cron] SEC Filing cron skipped: no tickers in SEC_WATCHLIST_TICKERS');
    return;
  }

  // SEC filings are typically released after market close (4:00 PM ET) or before open (6:00 AM ET).
  // Run at 7:00 AM ET (19:00 GMT+8) on weekdays to capture after-hours and pre-market filings.
  cron.schedule(
    '0 7 * * 1-5',
    async () => {
      logger.info(`[Cron] SEC Filing Analysis started for: ${WATCHLIST_TICKERS.join(', ')}`);
      try {
        await runAgent(WATCHLIST_TICKERS, ['10-K', '10-Q', '8-K'], 1);
        logger.info('[Cron] SEC Filing Analysis completed');
      } catch (error) {
        logger.error('[Cron] SEC Filing Analysis failed:', error);
      }
    },
    { timezone: 'America/New_York' },
  );

  logger.info(
    `[Cron] SEC Filing Analysis scheduled: weekdays 7:00 AM ET for ${WATCHLIST_TICKERS.join(', ')}`,
  );
}
