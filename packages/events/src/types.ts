export interface ChannelSendMessagePayload {
  channel: 'telegram' | 'feishu';
  messages: string[];
  extra?: {
    channelExtra?: {
      raw?: boolean;
      chatId?: string;
      threadId?: number;
      replyToMessageId?: number | string;
      feishuType?: 'message' | 'plain_text' | 'card_template';
      cardTemplate?: {
        templateId: string;
        variables: Record<string, string>;
      };
    };
  };
}

export interface AgentRssSumPayload {
  category: string;
  channelExtra: {
    chatId?: string;
    threadId?: number;
    replyToMessageId?: string | number;
    channel?: string;
  };
}

export interface AgentSecPayload {
  symbol: string;
  channelExtra: {
    chatId?: string;
    threadId?: number;
    replyToMessageId?: string | number;
    channel?: string;
  };
}
