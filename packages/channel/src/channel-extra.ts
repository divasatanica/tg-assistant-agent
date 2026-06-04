import type { TelegramTarget, FeishuTarget } from '@krobert/events';

export function telegramTarget(params: {
  chatId?: string;
  threadId?: number;
  replyToMessageId?: number;
  raw?: boolean;
}): TelegramTarget {
  return { channel: 'telegram' as const, ...params };
}

export function feishuTarget(params: {
  chatId: string;
  replyToMessageId?: string;
  receiveIdType?: 'open_id' | 'chat_id' | 'user_id' | 'union_id';
}): FeishuTarget {
  return { channel: 'feishu' as const, feishuType: 'message' as const, ...params };
}

export function feishuCardTarget(params: {
  chatId: string;
  templateId: string;
  variables: Record<string, string>;
  receiveIdType?: 'open_id' | 'chat_id' | 'user_id' | 'union_id';
}): FeishuTarget {
  return {
    channel: 'feishu' as const,
    feishuType: 'card_template' as const,
    cardTemplate: { templateId: params.templateId, variables: params.variables },
    chatId: params.chatId,
    receiveIdType: params.receiveIdType,
  };
}
