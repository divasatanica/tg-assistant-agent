export interface ChannelSendMessagePayload {
  channel: 'telegram' | 'feishu';
  messages: string[];
  extra?: {
    tgExtra?: {
      raw?: boolean;
      chatId?: string;
      threadId?: number;
      replyToMessageId?: number | string;
    };
  };
}

export interface AgentRssSumPayload {
  category: string;
  tgExtra: {
    chatId?: string;
    threadId?: number;
    replyToMessageId?: number | string;
    channel?: string;
  };
}

export interface AgentSecPayload {
  symbol: string;
  tgExtra: {
    chatId?: string;
    threadId?: number;
    replyToMessageId?: number | string;
    channel?: string;
  };
}
