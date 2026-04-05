import { registerCommandHandler } from './command';
import { registerMessageHandler } from './message';
import { bot } from './telegraf';

export function bootstrapTelegramChannel() {
  registerCommandHandler(bot);
  registerMessageHandler(bot);

  bot.launch();
  console.log('Telegram channel is running...')
}