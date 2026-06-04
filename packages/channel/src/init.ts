import { ACTIVE_CHANNELS } from '@krobert/utils';
import { bootstrapTelegramChannel } from './telegram/index.js';
import { bootstrapFeishuChannel } from './feishu/index.js';
import { bootstrapChannelListener } from './message-channel.js';

export function bootstrapChannel() {
  if (ACTIVE_CHANNELS.includes('telegram')) {
    bootstrapTelegramChannel();
  }
  if (ACTIVE_CHANNELS.includes('feishu')) {
    bootstrapFeishuChannel();
  }

  bootstrapChannelListener();
}
