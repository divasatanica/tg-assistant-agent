import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import ollama from 'ollama';
import MarkdownIt from 'markdown-it';
import { escapeHTML } from '@/utils/format';
import { OLLAMA_MODEL_NAME } from '@/utils/config';

export function wrapMarkdownMessage(message: string) {
  const htmlContentRendered = MarkdownIt().render(message);
  return escapeHTML(htmlContentRendered);
}

export function sendMarkdownMessage(bot: Telegraf, chatId: string, message: string, messageThreadId?: number) {
  return bot.telegram.sendMessage(chatId, wrapMarkdownMessage(message), {
    message_thread_id: messageThreadId,
    parse_mode: 'HTML',
  });
}

export function registerMessageHandler(bot: Telegraf) {
  bot.on(message('text'), async (ctx) => {
    const userMessage = ctx.message.text;
    const messageId = ctx.message.message_id;

    if (userMessage === 'Output Debug Info in Logs') {
      console.log('ctx.message', ctx.message, ctx.chat, bot.botInfo?.username);
      return;
    }

    if (!userMessage.includes(`@${bot.botInfo?.username}`)) {
      console.log('Received not mentioned userMessage', userMessage, '[skipped...]');
      return;
    }

    console.log('Received mention userMessage', userMessage);

    try {
      // 调用本地运行的 Gemma 4
      const response = await ollama.chat({
        model: OLLAMA_MODEL_NAME,
        messages: [{ role: 'user', content: userMessage }],
        stream: false,
      });

      console.log('ollama response', response.done, response.done_reason);

      await ctx.reply(wrapMarkdownMessage(response.message.content), {
        reply_parameters: {
          message_id: messageId,
          allow_sending_without_reply: true,
        },
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Ollama Error:', error);
      await ctx.reply('抱歉，我的大脑暂时断网了...');
    }
  });
}
