import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';
import type { ChannelTarget } from '@krobert/events';
import {
  logger,
  parseMessageContent,
  TG_MESSAGE_THREAD_ID,
  TELEGRAM_PERSONAL_CHAT_ID,
  LARK_USER_OPEN_ID,
} from '@krobert/utils';
import { model } from '../global';
import type { AgentState, TelegramMessageTarget } from '../global';

function buildSecTargets(channelExtra: TelegramMessageTarget | undefined): ChannelTarget[] {
  const channels = channelExtra?.channels ?? ['telegram'];
  const targets: ChannelTarget[] = [];
  for (const ch of channels) {
    if (ch === 'telegram') {
      targets.push({
        channel: 'telegram',
        chatId: TELEGRAM_PERSONAL_CHAT_ID,
        threadId: Number(TG_MESSAGE_THREAD_ID.SEC_FILING),
        replyToMessageId: channelExtra?.replyToMessageId,
      });
    } else if (ch === 'feishu') {
      if (!LARK_USER_OPEN_ID) continue;
      targets.push({
        channel: 'feishu',
        chatId: LARK_USER_OPEN_ID,
        receiveIdType: 'open_id',
      });
    }
  }
  return targets;
}

export const analyzerNode = async (state: typeof AgentState.State) => {
  const context: Record<string, unknown> = {};

  for (const ticker of Object.keys(state.filings ?? {})) {
    context[ticker] = {
      filingInfo: (state.filings?.[ticker] ?? []).map((f) => ({
        formType: f.formType,
        filingDate: f.filingDate,
        reportDate: f.reportDate,
        url: f.htmlUrl,
      })),
      sections: (state.sections?.[ticker] ?? []).map((s) => ({
        label: s.label,
        text: s.text,
      })),
      financialMetrics: state.xbrlMetrics?.[ticker] ?? [],
    };
  }

  const contextJson = JSON.stringify(context);
  logger.info(`[SEC Agent] Context size: ${contextJson.length} chars, invoking Gemini...`);

  let response: Awaited<ReturnType<typeof model.invoke>> | null = null;
  let lastError: unknown;

  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      response = await model.invoke([
        ...(state.messages || []),
        ['user', `Here are the extracted SEC filing data for analysis:\n\n${contextJson}`],
      ]);
      break;
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      const delayMs = 1000 * 2 ** attempt;
      logger.warn(`[SEC Agent] Retrying analyzer invoke (${attempt + 1}/3) in ${delayMs}ms...`, {
        error,
      });
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  if (!response) {
    logger.error('[SEC Agent] Analyzer invoke failed after retries', { error: lastError });

    logger.debug('[SEC Agent] Emitting failure message', {
      threadId: TG_MESSAGE_THREAD_ID.SEC_FILING,
    });

    eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
      targets: buildSecTargets(state.channelExtra),
      messages: ['❌ SEC 分析失败：Gemini API 在 3 次重试后仍无法返回结果，请稍后重试。'],
    });

    throw lastError;
  }

  const finalReport = parseMessageContent(response.content);
  logger.info(`[SEC Agent] Analysis complete, ${finalReport.length} chars`);

  eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
    targets: buildSecTargets(state.channelExtra),
    messages: [finalReport],
  });

  return { finalReport };
};
