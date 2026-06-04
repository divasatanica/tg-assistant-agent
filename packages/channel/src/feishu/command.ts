import { Client } from '@larksuiteoapi/node-sdk';
import { rssDB } from '@krobert/utils/sqlite/sqlite';
import { logger } from '@krobert/utils';
import { eventBus, EVENT_AGENT_RSS_SUM, EVENT_AGENT_SEC } from '@krobert/events';
import { sendFeishuMessage } from './message';

/** 飞书 EventDispatcher im.message.receive_v1 回调 payload */
interface FeishuMessageEvent {
  event_id?: string;
  token?: string;
  create_time?: string;
  event_type?: string;
  tenant_key?: string;
  ts?: string;
  uuid?: string;
  type?: string;
  app_id?: string;
  message?: {
    message_id: string;
    root_id?: string;
    parent_id?: string;
    create_time: string;
    update_time?: string;
    chat_id: string;
    thread_id?: string;
    chat_type: string;
    message_type: string;
    content: string;
    mentions?: Array<{
      key: string;
      id: { union_id?: string; user_id?: string; open_id?: string };
      mentioned_type?: string;
      name: string;
    }>;
  };
  sender?: {
    sender_id?: {
      union_id?: string;
      user_id?: string;
      open_id?: string;
    };
    sender_type: string;
    tenant_key?: string;
  };
}

/** 解析飞书消息文本内容（content 是 JSON 字符串如 {"text":"/rsslist"}） */
function parseMessageText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return parsed.text ?? '';
  } catch {
    return content;
  }
}

/** 存储待选类别的 RSS 订阅信息（用于 /rsssub 两部曲：先发命令选类别，再回复类别确认） */
const pendingSubs = new Map<
  string,
  { url: string; subscription_type: string; title: string; userId: string }
>();

export async function handleFeishuMessage(client: Client, event: FeishuMessageEvent) {
  const msg = event?.message;
  if (!msg || msg.message_type !== 'text') return;

  const chatId = msg.chat_id;
  const messageId = msg.message_id;
  const senderId = event?.sender?.sender_id?.open_id ?? 'unknown';
  const text = parseMessageText(msg.content).trim();

  if (!text) return;

  logger.info('[Feishu] Received message', { text, chatId, senderId });

  // /rsssub <url> <type> "<title>"
  const rsssubMatch = text.match(/^\/rsssub\s+(\S+)\s+(\S+)\s+"([^"]+)"/);
  if (rsssubMatch) {
    const [, url, subscription_type, title] = rsssubMatch;
    const id = Date.now().toString(36);
    pendingSubs.set(id, { url, subscription_type, title, userId: senderId });

    const categories = ['General', 'News', 'Finance', 'Blog'];
    const categoryText = categories.join(' / ');
    await sendFeishuMessage(
      client,
      chatId,
      `正在订阅: **${title}**\n请回复类别: ${categoryText}`,
      messageId,
    );
    return;
  }

  // 用户回复类别文本（/rsssub 的第二步）
  const catReplyMatch = text.match(/^(General|News|Finance|Blog)$/);
  if (catReplyMatch) {
    const category = catReplyMatch[1];
    let foundId: string | null = null;
    for (const [id, pending] of pendingSubs) {
      if (pending.userId === senderId) {
        foundId = id;
        break;
      }
    }

    if (foundId) {
      const pending = pendingSubs.get(foundId)!;
      pendingSubs.delete(foundId);

      const success = rssDB.addSubscription(
        pending.url,
        pending.title,
        pending.subscription_type,
        category,
      );
      await sendFeishuMessage(
        client,
        chatId,
        success
          ? `✅ 已订阅: **${pending.title}** [${category}]\n${pending.url}`
          : `⚠️ 该 URL 已存在: ${pending.url}`,
        messageId,
      );
    }
    return;
  }

  // /rsslist
  if (text === '/rsslist') {
    logger.debug('[Feishu] Fetching subscription list for /rsslist command');
    const subs = rssDB.getAllSubscriptions();
    try {
      if (subs.length === 0) {
        await sendFeishuMessage(
          client,
          chatId,
          '📭 暂无订阅。使用 `/rsssub <url> <type> "<标题>"` 添加。',
          messageId,
        );
      } else {
        const lines = subs.map(
          (s, i) =>
            `${i + 1}. **${s.title}**\n   ${s.url} [${s.category}] [${s.subscription_type}]`,
        );
        await sendFeishuMessage(
          client,
          chatId,
          `📋 当前订阅 (${subs.length} 条):\n\n${lines.join('\n\n')}`,
          messageId,
        );
      }
    } catch (error) {
      console.log('[Feishu] Error sending subscription list message', error);
      // logger.error('[Feishu] Error sending subscription list message', error as any);
    }

    return;
  }

  // /rssunsub <url>
  const rssunsubMatch = text.match(/^\/rssunsub\s+(\S+)/);
  if (rssunsubMatch) {
    const url = rssunsubMatch[1];
    rssDB.removeSubscription(url);
    await sendFeishuMessage(client, chatId, `🗑️ 已取消订阅: ${url}`, messageId);
    return;
  }

  // /rsssum <category>
  const rsssumMatch = text.match(/^\/rsssum\s+(\S+)/);
  if (rsssumMatch) {
    const category = rsssumMatch[1].trim();
    eventBus.emit(EVENT_AGENT_RSS_SUM, {
      category,
      channelExtra: {
        chatId,
        replyToMessageId: messageId,
        channels: ['feishu'],
      },
    });
    return;
  }

  // /sec <symbol>
  const secMatch = text.match(/^\/sec\s+(\S+)/);
  if (secMatch) {
    const symbol = secMatch[1].replace(/^\$/, '').trim().toUpperCase();
    if (!symbol) {
      await sendFeishuMessage(client, chatId, '❌ symbol 不能为空', messageId);
      return;
    }
    eventBus.emit(EVENT_AGENT_SEC, {
      symbol,
      channelExtra: {
        chatId,
        replyToMessageId: messageId,
        channels: ['feishu'],
      },
    });
    return;
  }

  // 未知命令
  await sendFeishuMessage(
    client,
    chatId,
    `🤖 可用命令:\n\n` +
      `**RSS 订阅**\n` +
      `\`/rsssub <url> <type> "<标题>"\` — 添加订阅\n` +
      `\`/rsslist\` — 查看订阅列表\n` +
      `\`/rssunsub <url>\` — 取消订阅\n` +
      `\`/rsssum <类别>\` — 分析 RSS 摘要\n\n` +
      `**SEC 分析**\n` +
      `\`/sec <symbol>\` — 分析 SEC 文件`,
    messageId,
  );
}
