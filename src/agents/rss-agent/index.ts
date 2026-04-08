import { StateGraph, START, END } from '@langchain/langgraph';
import { SystemMessage } from '@langchain/core/messages';
import { readFileSync } from 'fs';
import { bot } from '@/channel/telegram/telegraf';
import { TELEGRAM_PERSONAL_CHAT_ID } from '@/utils/config';
import { sendMarkdownMessage } from '@/channel/telegram/message';
import { AgentState } from './global';
import { scraperNode } from './nodes/scraper';
import { analyzerNode } from './nodes/analyzer';
import { reporterNode } from './nodes/reporter';

const workflow = new StateGraph(AgentState)
const forkAfterRssFetched = ['reporter', 'analyzer'];
workflow
  // 1. 添加节点
  .addNode('scraper', scraperNode)
  .addNode('analyzer', analyzerNode)
  .addNode('reporter', reporterNode)
  .addNode("final_report_sender", reporterNode)

  // 2. 设定连线逻辑
  .addEdge(START, 'scraper') // 从开始到抓取
  .addConditionalEdges('scraper', () => forkAfterRssFetched)
  // 初报发完，这条支线直接 END，不干扰分析
  .addEdge("reporter", END)
  // 分析完后，走第二次播报
  .addEdge("analyzer", "final_report_sender")
  .addEdge("final_report_sender", END);

// 3. 编译成可执行的 App
const app = workflow.compile();

export async function runAgent() {
  const systemPrompt = readFileSync('./src/agents/rss-agent/system-prompt-Role.md', 'utf-8');
  const myCustomSystemPrompt = new SystemMessage(systemPrompt);
  const result = await app.invoke({
    messages: [myCustomSystemPrompt], // 初始消息为空
  });

  return {
    finalReport: result.finalReport,
    rssData: result.rssData,
  };
}
