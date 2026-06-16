import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import Parser from 'rss-parser';

import { googleModelFactory } from '../common/model';

export interface ArticleSummary {
  title: string;
  link: string;
  summary: string;
  pubDate?: string;
}

export interface TelegramMessageTarget {
  chatId?: string;
  threadId?: number;
  replyToMessageId?: string | number;
  channels?: Array<'telegram' | 'feishu'>;
  receiveIdType?: 'open_id' | 'chat_id' | 'user_id' | 'union_id';
}

const isDev = process.env.NODE_ENV === 'development';

export const summarizerModel = googleModelFactory(
  isDev ? 'gemma-4-26b-a4b-it' : 'gemma-4-26b-a4b-it',
);

export const keywordModel = googleModelFactory(
  isDev ? 'gemma-4-26b-a4b-it' : 'gemini-3.1-flash-lite',
);

export const analyzerModel = googleModelFactory(isDev ? 'gemma-4-26b-a4b-it' : 'gemini-3.5-flash');

// 定义全局状态架构
export const AgentState = Annotation.Root({
  // 存储对话消息流
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  // 存储抓取到的原始 RSS 数据
  rssData: Annotation<Record<string, Parser.Output<any>[]>>(),
  // 每篇文章的浓缩摘要
  articleSummaries: Annotation<Record<string, ArticleSummary[]>>(),
  // 从所有摘要中提取的关键词
  keywords: Annotation<string[]>(),
  // 最终生成的分析报告
  finalReport: Annotation<string>(),
  // 初始注入的要分析的订阅类目
  categories: Annotation<string[]>(),
  // Telegram 消息目标信息（chatId、threadId、replyToMessageId），cron 触发时为 undefined
  channelExtra: Annotation<TelegramMessageTarget | undefined>(),
});
