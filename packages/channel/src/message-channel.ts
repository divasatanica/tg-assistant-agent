import EventEmitter from 'node:events';
import { logger, TELEGRAM_PERSONAL_CHAT_ID } from '@krobert/utils';
import { sendMarkdownMessage, sendRawMessage } from './telegram/message';
import { bot } from './telegram/telegraf';
import { sleep } from 'bun';

export const messageChannel = new EventEmitter();

messageChannel.on('channel:send_message', async (payload) => {
  const { channel, messages = [], extra = {} } = payload;
  if (messages.length === 0) {
    return;
  }

  switch (channel) {
    case 'telegram': {
      const { tgExtra = {} } = extra;
      const { raw = false, chatId = TELEGRAM_PERSONAL_CHAT_ID, threadId = '' } = tgExtra;
      const sender = raw ? sendRawMessage : sendMarkdownMessage;

      for (const message of messages) {
        const result = await sender(bot, chatId, message, threadId);
        logger.debug('[MessageChannel] message sent result:', result);
        await sleep(1000);
      }
      break;
    }
    default: {
      logger.warn(`[MessageChannel] ${messages.length} messages with no channel specified`);
      break;
    }
  }
});
