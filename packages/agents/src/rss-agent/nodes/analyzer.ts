import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';
import { AgentState, model } from '../global';
import {
  logger,
  parseMessageContent,
  RSS_ANALYZER_MAX_RETRY_TIMES,
  RSS_ANALYZER_RETRY_BASE_DELAY_MS,
  TG_MESSAGE_THREAD_ID,
} from '@krobert/utils';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const analyzerNode = async (state: typeof AgentState.State) => {
  const isEmpty =
    Object.keys(state.rssData).length === 0 ||
    Object.values(state.rssData).every((items) => items.length === 0);
  if (isEmpty) {
    return { finalReport: 'No RSS feeds found.' };
  }

  logger.info('[RSSAgent] rssData retrieved, start analyzing');

  const context = JSON.stringify(state.rssData);
  const maxRetries =
    Number.isFinite(RSS_ANALYZER_MAX_RETRY_TIMES) && RSS_ANALYZER_MAX_RETRY_TIMES >= 0
      ? Math.floor(RSS_ANALYZER_MAX_RETRY_TIMES)
      : 3;
  const baseDelayMs =
    Number.isFinite(RSS_ANALYZER_RETRY_BASE_DELAY_MS) && RSS_ANALYZER_RETRY_BASE_DELAY_MS > 0
      ? RSS_ANALYZER_RETRY_BASE_DELAY_MS
      : 1000;

  let response: Awaited<ReturnType<typeof model.invoke>> | null = null;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      logger.info(
        `[RSSAgent] analyzer invoke attempt ${attempt + 1}/${maxRetries + 1}, context length: ${context.length}`,
      );
      response = await model.invoke([
        ...(state.messages || []),
        ['user', `Here's fetched feeds organized by category as JSON format: ${context}`],
      ]);
      break;
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) {
        break;
      }
      const delayMs = baseDelayMs * 2 ** attempt;
      logger.warn(
        `[RSSAgent] analyzer invoke failed, retrying (${attempt + 1}/${maxRetries}) in ${delayMs}ms`,
        { error },
      );
      await sleep(delayMs);
    }
  }

  if (!response) {
    logger.error('[RSSAgent] analyzer invoke failed after retries', { error: lastError });

    eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
      channel: state.tgExtra?.channel || 'telegram',
      messages: ['❌ RSS 分析失败：Gemini API 在重试后仍无法返回结果，请稍后重试。'],
      extra: {
        tgExtra: {
          chatId: state.tgExtra?.chatId,
          threadId: state.tgExtra?.threadId ?? TG_MESSAGE_THREAD_ID.NEWS_REPORT,
          replyToMessageId: state.tgExtra?.replyToMessageId,
        },
      },
    });

    throw lastError;
  }

  eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
    channel: state.tgExtra?.channel || 'telegram',
    messages: [parseMessageContent(response.content)],
    extra: {
      tgExtra: {
        chatId: state.tgExtra?.chatId,
        threadId: state.tgExtra?.threadId ?? TG_MESSAGE_THREAD_ID.NEWS_REPORT,
        replyToMessageId: state.tgExtra?.replyToMessageId,
      },
    },
  });

  return { finalReport: parseMessageContent(response.content) };
};
