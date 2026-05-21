import { telegramCommandChannel } from '@krobert/channel/telegram/command-channel';
import { runRssAgent, runSecFilingAgent } from '@krobert/agents';
import { EVENT_TELEGRAM_COMMAND_RSS_SUM, EVENT_TELEGRAM_COMMAND_SEC, logger } from '@krobert/utils';

export function registerTelegramCommandEventHandlers() {
  telegramCommandChannel.on(EVENT_TELEGRAM_COMMAND_RSS_SUM, ({ category }) => {
    void runRssAgent(category);
  });

  telegramCommandChannel.on(EVENT_TELEGRAM_COMMAND_SEC, async ({ symbol, chatId, threadId }) => {
    try {
      await runSecFilingAgent([symbol], ['10-K', '10-Q', '8-K'], 1, {
        tgExtra: { chatId, threadId },
      });
    } catch (error) {
      logger.error('[Telegram] /sec command failed', { symbol, error });
    }
  });
}
