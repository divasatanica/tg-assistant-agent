import { StateGraph, START, END } from '@langchain/langgraph';
import { SystemMessage } from '@langchain/core/messages';
import { readFileSync } from 'fs';
import { AgentState } from './global';
import { scraperNode } from './nodes/scraper';
import { analyzerNode } from './nodes/analyzer';
import { join } from 'path';
import { formatTime } from '@krobert/utils';

const workflow = new StateGraph(AgentState);
workflow
  // 1. 添加节点
  .addNode('scraper', scraperNode)
  .addNode('analyzer', analyzerNode)

  // 2. 设定连线逻辑
  .addEdge(START, 'scraper') // 从开始到抓取
  .addEdge('scraper', 'analyzer')
  // 分析完后，走第二次播报
  .addEdge('analyzer', END);

// 3. 编译成可执行的 App
const app = workflow.compile();

export async function runAgent(category: string) {
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
  });

  return {
    finalReport: result.finalReport,
    rssData: result.rssData,
  };
}
