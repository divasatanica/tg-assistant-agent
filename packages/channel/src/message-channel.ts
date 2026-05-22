import { logger, TELEGRAM_PERSONAL_CHAT_ID } from '@krobert/utils';
import { sendMarkdownMessage, sendRawMessage } from './telegram/message';
import { bot } from './telegram/telegraf';
import { feishuClient } from './feishu/index';
import { sendFeishuMessage } from './feishu/message';
import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';
import type { ChannelSendMessagePayload } from '@krobert/events';
import { sleep } from 'bun';

export function bootstrapChannelListener() {
  eventBus.on(EVENT_CHANNEL_SEND_MESSAGE, async (payload: ChannelSendMessagePayload) => {
    logger.debug('[MessageChannel] Received message send request:', payload);
    const { channel, messages = [], extra = {} } = payload;
    if (messages.length === 0) {
      return;
    }

    switch (channel) {
      case 'telegram': {
        const { tgExtra = {} } = extra;
        const {
          raw = false,
          chatId = TELEGRAM_PERSONAL_CHAT_ID,
          threadId = undefined,
          replyToMessageId,
        } = tgExtra;
        const sender = raw ? sendRawMessage : sendMarkdownMessage;

        for (const message of messages) {
          const result = await sender(bot, chatId, message, threadId, Number(replyToMessageId));
          logger.debug('[MessageChannel] message sent result:', result);
          await sleep(1000);
        }
        break;
      }
      case 'feishu': {
        const { tgExtra = {} } = extra;
        const { chatId, replyToMessageId } = tgExtra;

        if (!chatId) {
          logger.warn('[MessageChannel] Feishu message skipped: no chatId');
          break;
        }

        for (const message of messages) {
          await sendFeishuMessage(feishuClient, chatId, message, replyToMessageId as string);
          await sleep(800);
        }
        break;
      }
      default: {
        logger.warn(`[MessageChannel] ${messages.length} messages with no channel specified`);
        break;
      }
    }
  });
}
