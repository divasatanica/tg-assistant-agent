import { messageChannel } from '@krobert/channel/message-channel';
import {
  EVENT_MESSAGE_CHANNEL_SEND_MESSAGE,
  logger,
  MESSAGE_CHANNEL,
  parseMessageContent,
  TG_MESSAGE_THREAD_ID,
} from '@krobert/utils';
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
    throw lastError;
  }

  const finalReport = parseMessageContent(response.content);
  logger.info(`[SEC Agent] Analysis complete, ${finalReport.length} chars`);

  messageChannel.emit(EVENT_MESSAGE_CHANNEL_SEND_MESSAGE, {
    channel: MESSAGE_CHANNEL.TELEGRAM,
    messages: [finalReport],
    extra: {
      tgExtra: {
        threadId: TG_MESSAGE_THREAD_ID.SEC_FILING,
      },
    },
  });

  return { finalReport };
};
