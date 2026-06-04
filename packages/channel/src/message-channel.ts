import { logger, TELEGRAM_PERSONAL_CHAT_ID } from '@krobert/utils';
import { sendMarkdownMessage, sendRawMessage } from './telegram/message';
import { bot } from './telegram/telegraf';
import { feishuClient } from './feishu/index';
import { sendFeishuMessage, sendPlainText, sendFeishuCardTemplate } from './feishu/message';
import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';
import type { ChannelSendMessagePayload } from '@krobert/events';
import { sleep } from 'bun';

export function bootstrapChannelListener() {
  eventBus.on(EVENT_CHANNEL_SEND_MESSAGE, async (payload: ChannelSendMessagePayload) => {
    // logger.debug('[MessageChannel] Received message send request:', payload);
    const { targets = [], messages = [] } = payload;
    if (messages.length === 0 || targets.length === 0) {
      return;
    }

    for (const target of targets) {
      switch (target.channel) {
        case 'telegram': {
          const {
            raw = false,
            chatId = TELEGRAM_PERSONAL_CHAT_ID,
            threadId,
            replyToMessageId,
          } = target;
          const sender = raw ? sendRawMessage : sendMarkdownMessage;

          for (const message of messages) {
            const result = await sender(bot, chatId, message, threadId, Number(replyToMessageId));
            // logger.debug('[MessageChannel] message sent result:', result);
            await sleep(1000);
          }
          break;
        }
        case 'feishu': {
          const {
            chatId,
            replyToMessageId,
            feishuType = 'message',
            cardTemplate,
            receiveIdType = 'chat_id',
          } = target;

          if (!chatId) {
            logger.warn('[MessageChannel] Feishu message skipped: no chatId');
            break;
          }

          for (const message of messages) {
            if (feishuType === 'card_template') {
              if (!cardTemplate?.templateId) {
                logger.warn('[MessageChannel] Feishu card_template skipped: no templateId');
                continue;
              }
              await sendFeishuCardTemplate(
                feishuClient,
                chatId,
                cardTemplate.templateId,
                cardTemplate.variables ?? {},
                receiveIdType,
              );
            } else if (feishuType === 'plain_text') {
              await sendPlainText(feishuClient, chatId, message, receiveIdType);
            } else {
              await sendFeishuMessage(
                feishuClient,
                chatId,
                message,
                replyToMessageId,
                receiveIdType,
              );
            }
            await sleep(800);
          }
          break;
        }
      }
    }
  });
}
