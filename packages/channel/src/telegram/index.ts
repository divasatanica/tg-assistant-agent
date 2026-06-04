import { registerCommandHandler } from './command';
import { registerMessageHandler } from './message';
import { bot } from './telegraf';
import { TG_BOT_TOKEN } from '@krobert/utils/config';
import { logger } from '@krobert/utils';
import { TelegramError } from 'telegraf';

const TELEGRAM_RESTART_BASE_DELAY_MS = 5_000;
const TELEGRAM_RESTART_MAX_DELAY_MS = 60_000;
const TELEGRAM_RESTART_JITTER_MS = 1_000;

let telegramSupervisorStarted = false;
let telegramStopping = false;
let consecutiveLaunchFailures = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomJitter(maxMs: number) {
  return Math.floor(Math.random() * maxMs);
}

function getRestartDelayMs() {
  const exponentialDelay = Math.min(
    TELEGRAM_RESTART_BASE_DELAY_MS * 2 ** Math.max(consecutiveLaunchFailures - 1, 0),
    TELEGRAM_RESTART_MAX_DELAY_MS,
  );

  return exponentialDelay + randomJitter(TELEGRAM_RESTART_JITTER_MS);
}

function redactTelegramToken(value: string) {
  if (!TG_BOT_TOKEN) {
    return value;
  }

  return value.replaceAll(TG_BOT_TOKEN, '<telegram-bot-token>');
}

function serializeLaunchError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactTelegramToken(error.message),
      stack: error.stack ? redactTelegramToken(error.stack) : undefined,
    };
  }

  return { message: redactTelegramToken(String(error)) };
}

function isFatalTelegramLaunchError(error: unknown) {
  return error instanceof TelegramError && (error.code === 401 || error.code === 409);
}

async function superviseTelegramLaunch() {
  while (!telegramStopping) {
    try {
      logger.info('[Channel] Launching Telegram long polling...');
      await bot.launch(() => {
        consecutiveLaunchFailures = 0;
        logger.info('[Channel] Telegram bot is ready', {
          username: bot.botInfo?.username,
        });
      });

      if (!telegramStopping) {
        logger.warn('[Channel] Telegram long polling stopped unexpectedly');
      }
    } catch (error) {
      if (isFatalTelegramLaunchError(error)) {
        logger.error(
          '[Channel] Telegram long polling hit fatal error, exiting for process supervisor takeover',
          {
            ...serializeLaunchError(error),
            exitCode: 1,
          },
        );
        process.exit(1);
      }

      consecutiveLaunchFailures += 1;
      const delayMs = getRestartDelayMs();

      logger.error('[Channel] Telegram long polling failed', {
        ...serializeLaunchError(error),
        consecutiveLaunchFailures,
        nextRetryDelayMs: delayMs,
      });

      if (!telegramStopping) {
        await sleep(delayMs);
      }
      continue;
    }

    if (!telegramStopping) {
      consecutiveLaunchFailures += 1;
      const delayMs = getRestartDelayMs();

      logger.info('[Channel] Restarting Telegram long polling after delay...', {
        consecutiveLaunchFailures,
        delayMs,
      });
      await sleep(delayMs);
    }
  }
}

function stopTelegram(reason: string) {
  telegramStopping = true;

  try {
    bot.stop(reason);
  } catch (error) {
    logger.warn('[Channel] Telegram bot was already stopped', serializeLaunchError(error));
  }
}

export function bootstrapTelegramChannel() {
  if (telegramSupervisorStarted) {
    logger.warn(
      '[Channel] Telegram channel bootstrap skipped because supervisor is already running',
    );
    return;
  }

  telegramSupervisorStarted = true;

  registerCommandHandler(bot);
  registerMessageHandler(bot);

  process.once('SIGINT', () => stopTelegram('SIGINT'));
  process.once('SIGTERM', () => stopTelegram('SIGTERM'));

  void superviseTelegramLaunch();
  logger.info('[Channel] Telegram channel supervisor started');
}
