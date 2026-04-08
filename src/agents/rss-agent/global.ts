import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import { ChatOllama } from '@langchain/ollama';
import Parser from 'rss-parser';

export const model = new ChatOllama({
  model: 'gemma4:26b',
  temperature: 0,
  numCtx: 128000,
});

// 定义全局状态架构
export const AgentState = Annotation.Root({
  // 存储对话消息流
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  // 存储抓取到的原始 RSS 数据
  rssData: Annotation<Record<string, Parser.Output<any>[]>>(),
  // 最终生成的分析报告
  finalReport: Annotation<string>(),
});
