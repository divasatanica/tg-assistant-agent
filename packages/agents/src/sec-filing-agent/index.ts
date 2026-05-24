import { StateGraph, START, END } from '@langchain/langgraph';
import { SystemMessage } from '@langchain/core/messages';
import { readFileSync } from 'fs';
import { join } from 'path';
import { formatTime, logger } from '@krobert/utils';
import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';
import { AgentState } from './global';
import { fetchFilingsNode } from './nodes/fetch-filings';
import { extractSectionsNode } from './nodes/extract-sections';
import { fetchXbrlNode } from './nodes/fetch-xbrl';
import { analyzerNode } from './nodes/analyzer';
import type { TelegramMessageTarget } from './global';

function hasFilings(state: typeof AgentState.State): string {
  const totalFilings = Object.values(state.filings ?? {}).flat().length;
  if (totalFilings === 0) return END;
  return 'extractSections';
}

const workflow = new StateGraph(AgentState)
  .addNode('fetchFilings', fetchFilingsNode)
  .addNode('extractSections', extractSectionsNode)
  .addNode('fetchXbrl', fetchXbrlNode)
  .addNode('analyzer', analyzerNode)
  .addEdge(START, 'fetchFilings')
  .addConditionalEdges('fetchFilings', hasFilings, {
    [END]: END,
    extractSections: 'extractSections',
  })
  .addEdge('extractSections', 'fetchXbrl')
  .addEdge('fetchXbrl', 'analyzer')
  .addEdge('analyzer', END);

const app = workflow.compile();

interface RunSecFilingAgentOptions {
  channelExtra?: TelegramMessageTarget;
}

export async function runAgent(
  tickers: string[],
  formTypes: string[] = ['10-K'],
  maxFilingsPerTicker: number = 50,
  options: RunSecFilingAgentOptions = {},
) {
  const systemPromptPath = join(import.meta.dirname, 'system-prompt-extraction.md');
  let systemPrompt: string;
  try {
    systemPrompt = readFileSync(systemPromptPath, 'utf-8');
  } catch {
    systemPrompt =
      'You are a financial analyst. Analyze the provided SEC filing data and produce a structured report.';
  }

  logger.debug('[SEC Agent] Starting agent with parameters', {
    tickers,
    formTypes,
    maxFilingsPerTicker,
    channelExtra: options.channelExtra,
  });

  const result = await app.invoke({
    messages: [
      new SystemMessage(systemPrompt),
      new SystemMessage(
        `Today's date is ${formatTime(new Date(), { format: 'yyyy-MM-dd HH:mm' })}.`,
      ),
    ],
    tickers,
    formTypes,
    maxFilingsPerTicker,
    channelExtra: options.channelExtra,
  });

  // 如果没有找到任何文件且指定了 channelExtra，则在 Agent 自身内部发送通知消息
  const hasFilings =
    Object.values((result.filings ?? {}) as Record<string, unknown[]>).flat().length > 0;
  if (!hasFilings && options.channelExtra) {
    const noFilingsMsg = `⚠️ 未找到 ${tickers.join(', ')} 可分析的 SEC 文件。`;
    logger.info(`[SEC Agent] No filings found for ${tickers.join(', ')}, sending notification`);

    logger.debug('[SEC Agent] Emitting no filings message to Telegram channel', {
      threadId: options.channelExtra.threadId,
      chatId: options.channelExtra.chatId,
    });
    eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
      channel: options.channelExtra.channel || 'telegram',
      messages: [noFilingsMsg],
      extra: {
        channelExtra: {
          chatId: options.channelExtra.chatId,
          threadId: options.channelExtra.threadId,
          replyToMessageId: options.channelExtra.replyToMessageId,
        },
      },
    });
  }

  return {
    finalReport: result.finalReport,
    filings: result.filings,
    sections: result.sections,
    xbrlMetrics: result.xbrlMetrics,
  };
}
