import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';
import { logger, parseMessageContent, TG_MESSAGE_THREAD_ID } from '@krobert/utils';
import { model } from '../global';
import type { AgentState } from '../global';

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

    logger.debug('[SEC Agent] Emitting failure message to Telegram channel', {
      threadId: state.tgExtra?.threadId,
      chatId: state.tgExtra?.chatId,
    });

    eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
      channel: state.tgExtra?.channel || 'telegram',
      messages: ['❌ SEC 分析失败：Gemini API 在 3 次重试后仍无法返回结果，请稍后重试。'],
      extra: {
        tgExtra: {
          chatId: state.tgExtra?.chatId,
          threadId: state.tgExtra?.threadId ?? Number(TG_MESSAGE_THREAD_ID.SEC_FILING),
          replyToMessageId: state.tgExtra?.replyToMessageId,
        },
      },
    });

    throw lastError;
  }

  const finalReport = parseMessageContent(response.content);
  logger.info(`[SEC Agent] Analysis complete, ${finalReport.length} chars`);

  eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
    channel: state.tgExtra?.channel || 'telegram',
    messages: [finalReport],
    extra: {
      tgExtra: {
        chatId: state.tgExtra?.chatId,
        threadId: state.tgExtra?.threadId ?? Number(TG_MESSAGE_THREAD_ID.SEC_FILING),
        replyToMessageId: state.tgExtra?.replyToMessageId,
      },
    },
  });

  return { finalReport };
};
