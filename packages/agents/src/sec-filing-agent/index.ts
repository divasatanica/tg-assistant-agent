import { StateGraph, START, END } from '@langchain/langgraph';
import { SystemMessage } from '@langchain/core/messages';
import { readFileSync } from 'fs';
import { join } from 'path';
import { formatTime } from '@krobert/utils';
import { AgentState } from './global';
import { fetchFilingsNode } from './nodes/fetch-filings';
import { extractSectionsNode } from './nodes/extract-sections';
import { fetchXbrlNode } from './nodes/fetch-xbrl';
import { analyzerNode } from './nodes/analyzer';

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

export async function runAgent(
  tickers: string[],
  formTypes: string[] = ['10-K'],
  maxFilingsPerTicker: number = 1,
) {
  const systemPromptPath = join(import.meta.dirname, 'system-prompt-extraction.md');
  let systemPrompt: string;
  try {
    systemPrompt = readFileSync(systemPromptPath, 'utf-8');
  } catch {
    systemPrompt =
      'You are a financial analyst. Analyze the provided SEC filing data and produce a structured report.';
  }

  const result = await app.invoke({
    messages: [
      new SystemMessage(systemPrompt),
      new SystemMessage(
        `Today's date is ${formatTime(new Date(), { format: 'yyyy-MM-dd HH:mm' })}.`,
      ),
    ],
    tickers,
    _formTypes: formTypes,
    _maxFilingsPerTicker: maxFilingsPerTicker,
  } as Record<string, unknown>);

  return {
    finalReport: result.finalReport,
    filings: result.filings,
    sections: result.sections,
    xbrlMetrics: result.xbrlMetrics,
  };
}
