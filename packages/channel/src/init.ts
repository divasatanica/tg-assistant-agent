import { bootstrapTelegramChannel } from './telegram/index.js';

export function bootstrapChannel(onRunAgent?: (categories: string[]) => void) {
  bootstrapTelegramChannel(onRunAgent);
}
