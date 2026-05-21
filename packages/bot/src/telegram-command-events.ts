import { telegramCommandChannel } from '@krobert/channel/telegram/command-channel';
import { runRssAgent, runSecFilingAgent } from '@krobert/agents';
import {
  EVENT_TELEGRAM_COMMAND_RSS_SUM,
  EVENT_TELEGRAM_COMMAND_SEC,
  logger,
  TG_MESSAGE_THREAD_ID,
} from '@krobert/utils';

export function registerTelegramCommandEventHandlers() {
  telegramCommandChannel.on(EVENT_TELEGRAM_COMMAND_RSS_SUM, ({ category, chatId, messageId }) => {
    void runRssAgent(category, {
      chatId,
      threadId: Number(TG_MESSAGE_THREAD_ID.NEWS_REPORT),
      replyToMessageId: messageId,
    });
  });

  telegramCommandChannel.on(EVENT_TELEGRAM_COMMAND_SEC, async ({ symbol, chatId, messageId }) => {
    try {
      logger.debug(`[Telegram] Received /sec command for symbol: ${symbol}`, {
        symbol,
        chatId,
        messageId,
        threadId: Number(TG_MESSAGE_THREAD_ID.SEC_FILING),
      });
      await runSecFilingAgent([symbol], ['10-K', '10-Q', '8-K'], 50, {
        tgExtra: {
          chatId,
          threadId: Number(TG_MESSAGE_THREAD_ID.SEC_FILING),
          replyToMessageId: messageId,
        },
      });
    } catch (error) {
      logger.error('[Telegram] /sec command failed', { symbol, error });
    }
  });
}
