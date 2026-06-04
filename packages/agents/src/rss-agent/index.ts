import { StateGraph, START, END } from '@langchain/langgraph';
import { SystemMessage } from '@langchain/core/messages';
import { readFileSync } from 'fs';
import { AgentState, TelegramMessageTarget } from './global';
import { scraperNode } from './nodes/scraper';
import { summarizerNode } from './nodes/summarizer';
import { keywordsNode } from './nodes/keywords';
import { analyzerNode } from './nodes/analyzer';
import { join } from 'path';
import { formatTime } from '@krobert/utils';

function routeAfterScraper(state: typeof AgentState.State): 'summarizer' | 'analyzer' {
  const isNews = state.categories?.[0] === 'News';
  return isNews ? 'summarizer' : 'analyzer';
}

const workflow = new StateGraph(AgentState);
workflow
  .addNode('scraper', scraperNode)
  .addNode('summarizer', summarizerNode)
  .addNode('keyword-extractor', keywordsNode)
  .addNode('analyzer', analyzerNode)

  .addEdge(START, 'scraper')
  .addConditionalEdges('scraper', routeAfterScraper, {
    summarizer: 'summarizer',
    analyzer: 'analyzer',
  })
  .addEdge('summarizer', 'keyword-extractor')
  .addEdge('keyword-extractor', 'analyzer')
  .addEdge('analyzer', END);

// 3. 编译成可执行的 App
const app = workflow.compile();

export async function runAgent(category: string, channelExtra?: TelegramMessageTarget) {
  const categories = [category];
  const systemPrompts = categories.map((category) => {
    const systemPrompt = readFileSync(join(__dirname, `system-prompt-${category}.md`), 'utf-8');
    return new SystemMessage(systemPrompt);
  });
  const result = await app.invoke({
    messages: [
      ...systemPrompts,
      new SystemMessage(
        `Today's date is ${formatTime(new Date(), { format: 'yyyy-MM-dd HH:mm' })}.`,
      ),
    ],
    categories,
    channelExtra,
  });

  return {
    finalReport: result.finalReport,
    rssData: result.rssData,
  };
}
