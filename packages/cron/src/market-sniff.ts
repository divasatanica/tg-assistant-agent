import cron from 'node-cron';
import {
  EVENT_MESSAGE_CHANNEL_SEND_MESSAGE,
  formatPositions,
  logger,
  longBridgeClient,
  MESSAGE_CHANNEL,
  TG_MESSAGE_THREAD_ID,
} from '@krobert/utils';
import { messageChannel } from '@krobert/channel/message-channel';

export function bootstrapMarketSniffCron() {
  logger.info('[Cron] Bootstrapping Market Sniff daily task (Scheduled for 9:30 AM GMT-4)...');

  // 每天上午 9:30 GMT-4 - 0:00 UTC 执行
  cron.schedule(
    '30 9 * * *',
    async () => {
      logger.info('[Cron] Execution started: (9:30 AM GMT-4)...');
      const positions = await formatPositions();

      messageChannel.emit(EVENT_MESSAGE_CHANNEL_SEND_MESSAGE, {
        channel: MESSAGE_CHANNEL.TELEGRAM,
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
