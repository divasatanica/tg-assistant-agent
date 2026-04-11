import { registerCommandHandler } from './command';
import { registerMessageHandler } from './message';
import { bot } from './telegraf';

export function bootstrapTelegramChannel(onRunAgent?: (categories: string[]) => void) {
  registerCommandHandler(bot, onRunAgent);
  registerMessageHandler(bot);

  bot.launch();
  console.log('Telegram channel is running...');
}
