import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import ollama from 'ollama';
import MarkdownIt from 'markdown-it';
import { escapeHTML } from '@krobert/utils/format';
import { OLLAMA_MODEL_NAME } from '@krobert/utils/config';
import { logger } from '@krobert/utils';

export function wrapMarkdownMessage(message: string) {
  const htmlContentRendered = MarkdownIt().render(message);
  return escapeHTML(htmlContentRendered);
}

export function sendMarkdownMessage(
  bot: Telegraf,
  chatId: string,
  message: string,
  messageThreadId?: number,
) {
  return bot.telegram.sendMessage(chatId, wrapMarkdownMessage(message), {
    message_thread_id: messageThreadId,
    parse_mode: 'HTML',
  });
}

export function sendRawMessage(
  bot: Telegraf,
  chatId: string,
  message: string,
  messageThreadId?: number,
) {
  return bot.telegram.sendMessage(chatId, message, {
    message_thread_id: messageThreadId,
  });
}

export function editMessageText(bot: Telegraf, chatId: string, messageId: number, message: string) {
  return bot.telegram.editMessageText(chatId, messageId, undefined, message);
}

export function registerMessageHandler(bot: Telegraf) {
  bot.on(message('text'), async (ctx) => {
    const userMessage = ctx.message.text;
    const messageId = ctx.message.message_id;

    if (userMessage === 'Output Debug Info in Logs') {
      logger.debug('[Channel] ctx.message', {
        message: ctx.message,
        chat: ctx.chat,
        username: bot.botInfo?.username,
      });

      return;
    }

    if (!userMessage.includes(`@${bot.botInfo?.username}`)) {
      logger.debug('[Channel] Received not mentioned userMessage', {
        userMessage,
        status: '[skipped...]',
      });

      return;
    }

    logger.info('[Channel] Received mention userMessage', { userMessage });

    try {
      // 调用本地运行的 Gemma 4
      const response = await ollama.chat({
        model: OLLAMA_MODEL_NAME,
        messages: [{ role: 'user', content: userMessage }],
        stream: false,
      });

      logger.info('[Channel] ollama response', {
        done: response.done,
        reason: response.done_reason,
      });

      await ctx.reply(wrapMarkdownMessage(response.message.content), {
        reply_parameters: {
          message_id: messageId,
          allow_sending_without_reply: true,
        },
        parse_mode: 'HTML',
      });
    } catch (error) {
      logger.error('[Channel] Ollama Error:', error);

      await ctx.reply('抱歉，我的大脑暂时断网了...');
    }
  });
}
