import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import ollama from 'ollama';
import MarkdownIt from 'markdown-it';
import { escapeHTML } from '@/utils/format';
import { OLLAMA_MODEL_NAME } from '@/utils/config';

export function registerMessageHandler(bot: Telegraf) {
  bot.on(message('text'), async (ctx) => {
    const userMessage = ctx.message.text;
    const messageId = ctx.message.message_id;

    if (userMessage === 'Output Debug Info in Logs') {
      console.log('ctx.message', ctx.message);
      return;
    }

    console.log('Received userMessage', userMessage);

    try {
      // 调用本地运行的 Gemma 4
      const response = await ollama.chat({
        model: OLLAMA_MODEL_NAME,
        messages: [{ role: 'user', content: userMessage }],
        stream: false,
      });

      console.log('ollama response', response.done, response.done_reason);

      const htmlContentRendered = MarkdownIt().render(response.message.content);

      console.log('safeContent', htmlContentRendered)

      await ctx.reply(escapeHTML(htmlContentRendered), {
        reply_parameters: {
          message_id: messageId,
          allow_sending_without_reply: true,
        },
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Ollama Error:', error);
      await ctx.reply('抱歉，我的大脑暂时断网了...');
    }
  });
}