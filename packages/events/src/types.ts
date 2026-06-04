export interface TelegramTarget {
  channel: 'telegram';
  raw?: boolean;
  chatId?: string;
  threadId?: number | string;
  replyToMessageId?: number | string;
}

export interface FeishuTarget {
  channel: 'feishu';
  chatId: string;
  replyToMessageId?: string | number;
  receiveIdType?: 'open_id' | 'chat_id' | 'user_id' | 'union_id';
  feishuType?: 'message' | 'plain_text' | 'card_template';
  cardTemplate?: {
    templateId: string;
    variables: Record<string, string>;
  };
}

export type ChannelTarget = TelegramTarget | FeishuTarget;

export interface ChannelSendMessagePayload {
  targets: ChannelTarget[];
  messages: string[];
}

export interface AgentRssSumPayload {
  category: string;
  channelExtra: {
    chatId?: string;
    threadId?: number;
    replyToMessageId?: string | number;
    channels?: Array<'telegram' | 'feishu'>;
    receiveIdType?: 'open_id' | 'chat_id' | 'user_id' | 'union_id';
  };
}

export interface AgentSecPayload {
  symbol: string;
  channelExtra: {
    chatId?: string;
    threadId?: number;
    replyToMessageId?: string | number;
    channels?: Array<'telegram' | 'feishu'>;
    receiveIdType?: 'open_id' | 'chat_id' | 'user_id' | 'union_id';
  };
}
