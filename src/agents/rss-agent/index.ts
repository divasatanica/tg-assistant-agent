import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { BaseMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOllama } from '@langchain/ollama';
import Parser from 'rss-parser';
import { readFileSync } from 'fs';
import { fetchAndParseRSS } from '@/function-tools/rss-feed/parser';
import { rssDB } from '@/utils/sqlite/sqlite';
import { bot } from '@/channel/telegram/telegraf';
import { TELEGRAM_PERSONAL_CHAT_ID } from '@/utils/config';
import { sendMarkdownMessage } from '@/channel/telegram/message';

const model = new ChatOllama({
  model: 'gemma4:26b',
  temperature: 0,
});

// 定义全局状态架构
export const AgentState = Annotation.Root({
  // 存储对话消息流
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  // 存储抓取到的原始 RSS 数据
  rssData: Annotation<any[]>(),
  // 最终生成的分析报告
  finalReport: Annotation<string>(),
});


// 节点 1: 抓取数据
const scraperNode = async (state: typeof AgentState.State) => {
  const rssList = rssDB.getAllSubscriptions();

  console.log('rsslist', rssList);

  const data = await Promise.all(rssList.map(async (rss) => {
    const url = rss.url; // 你的 RSSHub 链接
    const data = await fetchAndParseRSS(url);
    return data;
  }));

  const concatedData = rssList.reduce((acc, rss, index) => {
    const category = rss.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    const { items, description, link, title = rss.title } = data[index]!;
    acc[category].push({ items, description, link, title });
    return acc;
  }, {} as Record<string, Array<Parser.Output<any>>>);

  console.log('concatedData', concatedData);

  return { rssData: concatedData };
};

// 节点 2: 使用 Gemma 4 进行分析
const analyzerNode = async (state: typeof AgentState.State) => {
  const context = JSON.stringify(state.rssData);
  const response = await model.invoke([
    ...(state.messages || []),
    ["user", `Here's fetched feeds organized by category as JSON format: ${context}`]
  ]);
  return { finalReport: response.content as string };
};

const workflow = new StateGraph(AgentState)
  // 1. 添加节点
  .addNode("scraper", scraperNode)
  .addNode("analyzer", analyzerNode)

  // 2. 设定连线逻辑
  .addEdge(START, "scraper")      // 从开始到抓取
  .addEdge("scraper", "analyzer") // 抓取完后分析
  .addEdge("analyzer", END);      // 分析完后结束

// 3. 编译成可执行的 App
const app = workflow.compile();

export async function runAgent() {
  const systemPrompt = readFileSync('./src/agents/rss-agent/system-prompt-Role.md', 'utf-8');
  const myCustomSystemPrompt = new SystemMessage(systemPrompt);
  const result = await app.invoke({
    messages: [myCustomSystemPrompt], // 初始消息为空
  });

  console.log("--- 订阅分析报告 ---");

  const sendMessageResult = await sendMarkdownMessage(bot, TELEGRAM_PERSONAL_CHAT_ID, result.finalReport, Number(process.env.TG_NEWS_REPORT_THREAD_ID));

  console.log('sendMessageResult', sendMessageResult);

  return {
    finalReport: result.finalReport,
    rssData: result.rssData,
  };
}