import { Client } from '@larksuiteoapi/node-sdk';
import { logger, sleep } from '@krobert/utils';
import { parseMarkdownToFeishu, segmentToFeishuData } from './markdown-to-feishu';

/**
 * 发送飞书消息（自动处理 Markdown 表格→互动卡片转换）
 *
 * 内部流程：
 * 1. 调用 parseMarkdownToFeishu 解析 Markdown 为段落数组
 * 2. 每个段落按类型发送：post → 富文本消息，interactive → 卡片消息
 * 3. 段落间间隔 500ms 防止频率限制
 */
export async function sendFeishuMessage(
  client: Client,
  chatId: string,
  content: string,
  _replyToMessageId?: string | number,
  receiveIdType: 'open_id' | 'chat_id' | 'user_id' | 'union_id' = 'chat_id',
): Promise<void> {
  try {
    const segments = parseMarkdownToFeishu(content);

    if (segments.length === 0) {
      await sendPlainText(client, chatId, content, receiveIdType);
      return;
    }

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const { msg_type, content: msgContent } = segmentToFeishuData(segment);

      await client.im.message.create({
        params: { receive_id_type: receiveIdType },
        data: {
          receive_id: chatId,
          msg_type: msg_type as string,
          content: msgContent as string,
        },
      });

      logger.debug('[Feishu] Message sent', {
        chatId,
        receiveIdType,
        segmentType: segment.type,
        index: i,
        total: segments.length,
      });

      if (i < segments.length - 1) {
        await sleep(500);
      }
    }
  } catch (error) {
    logger.error('[Feishu] Failed to send message', error as any);
    // fallback: 纯文本发送
    try {
      const plainText = content.replace(/[*#`|\[\]()]/g, '').slice(0, 2000);
      await sendPlainText(client, chatId, plainText, receiveIdType);
    } catch {
      logger.error('[Feishu] Fallback plain text send also failed');
    }
  }
}

export async function sendPlainText(
  client: Client,
  chatId: string,
  text: string,
  receiveIdType: 'open_id' | 'chat_id' | 'user_id' | 'union_id' = 'chat_id',
): Promise<void> {
  await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text: text.slice(0, 30000) }),
    },
  });
}

export async function sendFeishuCardTemplate(
  client: Client,
  chatId: string,
  templateId: string,
  variables: Record<string, string>,
  receiveIdType: 'open_id' | 'chat_id' | 'user_id' | 'union_id' = 'chat_id',
): Promise<void> {
  logger.debug('[Feishu] Sending card template message', {
    chatId,
    templateId,
    variables,
    receiveIdType,
  });
  await client.im.message.createByCard({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: chatId,
      template_id: templateId,
      template_variable: variables,
    },
  });
}
