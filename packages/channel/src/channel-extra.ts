export interface ChannelExtra {
  chatId?: string;
  threadId?: number;
  replyToMessageId?: number | string;
  channel?: string;
  feishuType?: 'message' | 'plain_text' | 'card_template';
  cardTemplate?: {
    templateId: string;
    variables: Record<string, string>;
  };
}

export function telegramExtra(
  chatId?: string,
  threadId?: number,
  replyToMessageId?: number,
): ChannelExtra {
  return { chatId, threadId, replyToMessageId, channel: 'telegram' };
}

export function feishuExtra(chatId: string, replyToMessageId?: string): ChannelExtra {
  return { chatId, replyToMessageId, channel: 'feishu' };
}

export function feishuCardExtra(
  chatId: string,
  templateId: string,
  variables: Record<string, string>,
): ChannelExtra {
  return {
    chatId,
    channel: 'feishu',
    feishuType: 'card_template',
    cardTemplate: { templateId, variables },
  };
}
