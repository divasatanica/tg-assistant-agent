import { Telegraf } from 'telegraf';
import { TG_BOT_TOKEN } from '@krobert/utils/config';

export const bot = new Telegraf(TG_BOT_TOKEN);

function isTelegrafReadonlyRedactionError(error: unknown) {
  return (
    error instanceof TypeError &&
    error.message === 'Attempted to assign to readonly property.' &&
    error.stack?.includes('redactToken')
  );
}

const originalCallApi = bot.telegram.callApi.bind(bot.telegram);

bot.telegram.callApi = (async (...args) => {
  const [method] = args;

  try {
    return await originalCallApi(...args);
  } catch (error) {
    if (method === 'getUpdates' && isTelegrafReadonlyRedactionError(error)) {
      const retriableError = new Error(
        'Telegram getUpdates request failed before token redaction. This is a Bun/Telegraf compatibility issue triggered by a transient network error.',
        { cause: error },
      );
      retriableError.name = 'FetchError';
      throw retriableError;
    }

    throw error;
  }
}) as typeof bot.telegram.callApi;
