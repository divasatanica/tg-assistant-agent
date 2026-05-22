import { registerCommandHandler } from './command';
import { registerMessageHandler } from './message';
import { bot } from './telegraf';
import { logger } from '@krobert/utils';

export function bootstrapTelegramChannel() {
  registerCommandHandler(bot);
  registerMessageHandler(bot);

  bot.launch();
  logger.info('[Channel] Telegram channel is running...');
}
