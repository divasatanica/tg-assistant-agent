import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';
import type { ChannelTarget } from '@krobert/events';
import { HumanMessage } from '@langchain/core/messages';
import { AgentState } from '../global';
import {
  logger,
  parseMessageContent,
  RSS_ANALYZER_MAX_RETRY_TIMES,
  RSS_ANALYZER_RETRY_BASE_DELAY_MS,
  TG_MESSAGE_THREAD_ID,
  formatTime,
  FEISHU_RSS_CARD_TEMPLATE_ID,
  TELEGRAM_PERSONAL_CHAT_ID,
  LARK_USER_OPEN_ID,
} from '@krobert/utils';
import { googleModelFactory } from '../../common/model';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const analyzerNode = async (state: typeof AgentState.State) => {
  const isEmpty =
    Object.keys(state.rssData).length === 0 ||
    Object.values(state.rssData).every((items) => items.length === 0);
  if (isEmpty) {
    return { finalReport: 'No RSS feeds found.' };
  }

  logger.info('[RSSAgent] rssData retrieved, start analyzing');

  const channels = state.channelExtra?.channels ?? ['telegram'];

  const llm = googleModelFactory();

  const context = JSON.stringify(state.rssData);
  const maxRetries =
    Number.isFinite(RSS_ANALYZER_MAX_RETRY_TIMES) && RSS_ANALYZER_MAX_RETRY_TIMES >= 0
      ? Math.floor(RSS_ANALYZER_MAX_RETRY_TIMES)
      : 3;
  const baseDelayMs =
    Number.isFinite(RSS_ANALYZER_RETRY_BASE_DELAY_MS) && RSS_ANALYZER_RETRY_BASE_DELAY_MS > 0
      ? RSS_ANALYZER_RETRY_BASE_DELAY_MS
      : 1000;

  let response: Awaited<ReturnType<typeof llm.invoke>> | null = null;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      logger.info(
        `[RSSAgent] analyzer invoke attempt ${attempt + 1}/${maxRetries + 1}, ` +
          `context length: ${context.length}`,
      );
      response = await llm.invoke([
        ...(state.messages || []),
        new HumanMessage(`Here's fetched feeds organized by category as JSON format: ${context}`),
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

    const errTargets: ChannelTarget[] = [];
    for (const ch of channels) {
      if (ch === 'telegram') {
        errTargets.push({
          channel: 'telegram',
          chatId: TELEGRAM_PERSONAL_CHAT_ID,
          threadId: TG_MESSAGE_THREAD_ID.NEWS_REPORT,
        });
      } else if (ch === 'feishu') {
        const fsId = LARK_USER_OPEN_ID;
        if (!fsId) continue;
        errTargets.push({
          channel: 'feishu',
          chatId: fsId,
          receiveIdType: 'open_id',
        });
      }
    }

    eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
      targets: errTargets,
      messages: ['❌ RSS 分析失败：Gemini API 在重试后仍无法返回结果，请稍后重试。'],
    });

    throw lastError;
  }

  // ─── Natural-language text (always present) ───
  const reportText = parseMessageContent(response.content);
  const category = state.categories[0] ?? 'General';

  logger.info(`[RSSAgent] analyzer invoke succeeded, report length: ${reportText.length}`);

  const targets: ChannelTarget[] = [];
  for (const ch of channels) {
    if (ch === 'telegram') {
      targets.push({
        channel: 'telegram',
        chatId: TELEGRAM_PERSONAL_CHAT_ID,
        threadId: TG_MESSAGE_THREAD_ID.NEWS_REPORT,
        replyToMessageId: state.channelExtra?.replyToMessageId,
      });
    } else if (ch === 'feishu') {
      if (!LARK_USER_OPEN_ID) continue;
      targets.push({
        channel: 'feishu',
        chatId: LARK_USER_OPEN_ID,
        receiveIdType: 'open_id',
        feishuType: 'card_template',
        cardTemplate: {
          templateId: FEISHU_RSS_CARD_TEMPLATE_ID,
          variables: {
            title: `RSS 订阅流 - ${category}`,
            date: formatTime(new Date(), { format: 'yyyy-MM-dd' }),
            content: reportText,
          },
        },
      });
    }
  }

  eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
    targets,
    messages: [reportText],
  });

  return { finalReport: reportText };
};
