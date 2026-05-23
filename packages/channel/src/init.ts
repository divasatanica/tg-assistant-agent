import { bootstrapTelegramChannel } from './telegram/index.js';
import { bootstrapFeishuChannel } from './feishu/index.js';
import { bootstrapChannelListener } from './message-channel.js';

export function bootstrapChannel() {
  bootstrapTelegramChannel();
  // bootstrapFeishuChannel();
  bootstrapChannelListener();
}
