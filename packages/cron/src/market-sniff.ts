import cron from 'node-cron';
import {
  formatPositions,
  logger,
  longBridgeClient,
  TG_MESSAGE_THREAD_ID,
  TELEGRAM_PERSONAL_CHAT_ID,
  LARK_USER_OPEN_ID,
} from '@krobert/utils';
import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';
import type { ChannelTarget } from '@krobert/events';

export function bootstrapMarketSniffCron() {
  logger.info('[Cron] Bootstrapping Market Sniff daily task (Scheduled for 9:30 AM GMT-4)...');

  // 每天上午 9:30 GMT-4 - 0:00 UTC 执行
  cron.schedule(
    '30 9 * * *',
    async () => {
      logger.info('[Cron] Execution started: (9:30 AM GMT-4)...');
      const positions = await formatPositions();

      const channels: Array<'telegram' | 'feishu'> = ['telegram'];
      const targets: ChannelTarget[] = [];
      for (const ch of channels) {
        if (ch === 'telegram') {
          targets.push({
            channel: 'telegram',
            chatId: TELEGRAM_PERSONAL_CHAT_ID,
            threadId: TG_MESSAGE_THREAD_ID.STOCK,
          });
        } else if (ch === 'feishu') {
          if (!LARK_USER_OPEN_ID) continue;
          targets.push({
            channel: 'feishu',
            chatId: LARK_USER_OPEN_ID,
            receiveIdType: 'open_id',
          });
        }
      }

      eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
        targets,
        messages: [positions],
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
