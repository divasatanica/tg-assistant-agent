export const EVENT_MESSAGE_CHANNEL_SEND_MESSAGE = 'channel:send_message';
export const EVENT_TELEGRAM_COMMAND_RSS_SUM = 'telegram:command:rsssum';
export const EVENT_TELEGRAM_COMMAND_SEC = 'telegram:command:sec';

export const ACTIVE_CHANNELS: Array<'telegram' | 'feishu'> = ['telegram', 'feishu'];

export const FEISHU_RSS_CARD_TEMPLATE_ID = 'AAqtz6z5gMo60';

export const LARK_USER_OPEN_ID = process.env.LARK_USER_OPEN_ID || '';

export const MESSAGE_CHANNEL = {
  TELEGRAM: 'telegram',
  FEISHU: 'feishu',
};
