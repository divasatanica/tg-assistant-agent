import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';
import type { ChannelTarget } from '@krobert/events';
import { HumanMessage } from '@langchain/core/messages';
import { AgentState, analyzerModel } from '../global';
import {
  logger,
  parseMessageContent,
  TG_MESSAGE_THREAD_ID,
  formatTime,
  FEISHU_RSS_CARD_TEMPLATE_ID,
  TELEGRAM_PERSONAL_CHAT_ID,
  LARK_USER_OPEN_ID,
} from '@krobert/utils';

export const analyzerNode = async (state: typeof AgentState.State) => {
  const isEmpty =
    Object.keys(state.rssData).length === 0 ||
    Object.values(state.rssData).every((items) => items.length === 0);
  if (isEmpty) {
    return { finalReport: 'No RSS feeds found.' };
  }

  logger.info('[RSSAgent] rssData retrieved, start analyzing');

  const channels = state.channelExtra?.channels ?? ['telegram'];

  const hasSummaries = state.articleSummaries && Object.keys(state.articleSummaries).length > 0;

  const context = hasSummaries
    ? JSON.stringify({
        articleSummaries: state.articleSummaries,
        keywords: state.keywords,
      })
    : JSON.stringify(state.rssData);
  let response: Awaited<ReturnType<typeof analyzerModel.invoke>> | null = null;
  let lastError: unknown;

  try {
    logger.info(`[RSSAgent] analyzer invoke started, context length: ${context.length}`);
    response = await analyzerModel.invoke([
      ...(state.messages || []),
      new HumanMessage(
        hasSummaries
          ? `Here are summarized articles and keywords for analysis:\n\n${context}`
          : `Here's fetched feeds organized by category as JSON format: ${context}`,
      ),
    ]);
  } catch (error) {
    lastError = error;
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

  let reportText = parseMessageContent(response.content);
  const category = state.categories[0] ?? 'General';
  const keywords = state.keywords ?? [];

  logger.debug(`[RSSAgent] keywords: ${keywords.join(', ')}`);

  if (keywords.length > 0) {
    const keywordLine = `**关键词**: ${keywords.join('、')}`;
    reportText = `${keywordLine}\n\n${reportText}`;
  }

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
