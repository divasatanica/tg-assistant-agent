import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import Parser from 'rss-parser';

import { ollamaModelFactory } from '../common/model';

export const model = ollamaModelFactory();

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
  // 初始注入的要分析的订阅类目
  categories: Annotation<string[]>(),
});
