import { Telegraf, Markup } from 'telegraf';
import { rssDB } from '@/utils/sqlite/sqlite';
import { runAgent } from '@/agents/rss-agent';

// 临时存储待选类别的订阅信息 (避免 callback_data 长度超过 64 bytes)
const pendingSubs = new Map<string, { url: string; title: string; userId: number }>();

export function registerCommandHandler(bot: Telegraf) {
  bot.command('rsssub', (ctx) => {
    // 格式: /rsssub <url> "<标题>"
    const text = ctx.message.text;

    const match = text.match(/^\/rsssub\s+(\S+)\s+"([^"]+)"/);

    if (!match) {
      return ctx.reply('❌ 用法: /rsssub <url> "<标题>"');
    }

    const [, url, title] = match;
    const userId = ctx.from.id;

    // 生成短唯一标识
    const id = Date.now().toString(36);
    pendingSubs.set(id, { url, title, userId });

    ctx.reply(`正在订阅: <b>${title}</b>\n请选择类别:`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('General', `rsssub_cat:${id}:General`),
          Markup.button.callback('News', `rsssub_cat:${id}:News`),
        ],
        [
          Markup.button.callback('Finance', `rsssub_cat:${id}:Finance`),
          Markup.button.callback('Blog', `rsssub_cat:${id}:Blog`),
        ],
      ]),
    });
  });

  bot.action(/^rsssub_cat:([a-z0-9]+):(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    const category = ctx.match[2];
    const userId = ctx.from?.id;

    const pending = pendingSubs.get(id);
    if (!pending) {
      await ctx.answerCbQuery('❌ 该操作已过期', { show_alert: true });
      return;
    }

    if (pending.userId !== userId) {
      await ctx.answerCbQuery('❌ 你无权操作此项', { show_alert: true });
      return;
    }

    const { url, title } = pending;
    pendingSubs.delete(id); // 清理

    const success = rssDB.addSubscription(url, title, category);

    // 移除 inline 键盘并更新文本
    await ctx.editMessageText(
      success ? `✅ 已订阅: <b>${title}</b> [${category}]\n${url}` : `⚠️ 该 URL 已存在: ${url}`,
      { parse_mode: 'HTML' },
    );
    await ctx.answerCbQuery();
  });

  bot.command('rsslist', (ctx) => {
    const subs = rssDB.getAllSubscriptions();
    if (subs.length === 0) {
      return ctx.reply('📭 暂无订阅。使用 /rsssub <url> <标题> 添加。');
    }
    const text = subs
      .map(
        (s, i) =>
          `${i + 1}. <b>${s.title}</b>\n   ${s.url} [${s.category}] [${s.subscription_type}]`,
      )
      .join('\n\n');
    ctx.reply(`📋 当前订阅 (${subs.length} 条):\n\n${text}`, { parse_mode: 'HTML' });
  });

  bot.command('rssunsub', (ctx) => {
    const url = ctx.message.text.split(' ')[1];
    if (!url) {
      return ctx.reply('❌ 用法: /rssunsub <url>');
    }
    rssDB.removeSubscription(url);
    ctx.reply(`🗑️ 已取消订阅: ${url}`);
  });

  bot.command('rsssum', (ctx) => {
    const text = ctx.message.text;
    const match = text.match(/^\/rsssum\s+(.+)$/);

    if (!match) {
      return ctx.reply('❌ 用法: /rsssum 类别1 类别2 ...');
    }

    const categories = match[1].trim().split(/\s+/);

    runAgent(categories);

    ctx.reply(`正在分析类别: ${categories.join(', ')} ...`);
  });
}
