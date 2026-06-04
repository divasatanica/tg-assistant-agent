import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import { googleModelFactory } from '../common/model';
import type { ParsedSection } from './filing-parser';
import type { XbrlMetrics } from './xbrl-extractor';
import { GOOGLE_MODEL_NAME_MAP } from 'packages/utils/src/config';

export const model = googleModelFactory(GOOGLE_MODEL_NAME_MAP.SEC_ANALYSIS);

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
  replyToMessageId?: number | string;
  channels?: Array<'telegram' | 'feishu'>;
  receiveIdType?: 'open_id' | 'chat_id' | 'user_id' | 'union_id';
}

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  tickers: Annotation<string[]>(),
  formTypes: Annotation<string[]>(),
  maxFilingsPerTicker: Annotation<number>(),
  filings: Annotation<Record<string, FilingMetadata[]>>(),
  sections: Annotation<Record<string, ParsedSection[]>>(),
  xbrlMetrics: Annotation<Record<string, XbrlMetrics[]>>(),
  channelExtra: Annotation<TelegramMessageTarget | undefined>(),
  finalReport: Annotation<string>(),
});
