import cron from 'node-cron';
import { formatPositions, logger, longBridgeClient, TG_MESSAGE_THREAD_ID } from '@krobert/utils';
import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';

export function bootstrapMarketSniffCron() {
  logger.info('[Cron] Bootstrapping Market Sniff daily task (Scheduled for 9:30 AM GMT-4)...');

  // 每天上午 9:30 GMT-4 - 0:00 UTC 执行
  cron.schedule(
    '30 9 * * *',
    async () => {
      logger.info('[Cron] Execution started: (9:30 AM GMT-4)...');
      const positions = await formatPositions();

      eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
        channel: 'telegram',
        messages: [positions],
        extra: {
          tgExtra: {
            threadId: TG_MESSAGE_THREAD_ID.STOCK,
          },
        },
      });
    },
    {
      timezone: 'America/New_York',
    },
  );

  cron.schedule(
    '0 16 * * *',
    async () => {
      logger.info('[Cron] Execution started: Market Sniff (4:00 PM GMT-4)...');
      const positions = await longBridgeClient.getPosition();
      logger.info('[Cron] Positions:', positions);
    },
    {
      timezone: 'America/New_York',
    },
  );
}
