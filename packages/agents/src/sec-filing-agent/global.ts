import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import { googleModelFactory } from '../common/model';
import type { ParsedSection } from './filing-parser';
import type { XbrlMetrics } from './xbrl-extractor';

export const model = googleModelFactory();

export interface FilingMetadata {
  ticker: string;
  cik: string;
  formType: string;
  filingDate: string;
  reportDate: string;
  accessionNumber: string;
  primaryDocument: string;
  htmlUrl: string;
}

export type { ParsedSection } from './filing-parser';
export type { XbrlMetrics } from './xbrl-extractor';

export interface TelegramMessageTarget {
  chatId?: string;
  threadId?: number;
}

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  tickers: Annotation<string[]>(),
  filings: Annotation<Record<string, FilingMetadata[]>>(),
  sections: Annotation<Record<string, ParsedSection[]>>(),
  xbrlMetrics: Annotation<Record<string, XbrlMetrics[]>>(),
  tgExtra: Annotation<TelegramMessageTarget | undefined>(),
  finalReport: Annotation<string>(),
});
