import dotenv from 'dotenv';
import { resolve } from 'path';

const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';

dotenv.config({ path: resolve(process.cwd(), envFile), override: true });

export const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN!;
export const OLLAMA_MODEL_NAME = process.env.OLLAMA_MODEL_NAME!;
export const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH!;
export const TELEGRAM_PERSONAL_CHAT_ID = process.env.TG_PERSONAL_CHAT_ID!;
export const GOOGLE_MODEL_NAME = process.env.GOOGLE_MODEL_NAME!;
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const SEC_USER_AGENT = process.env.SEC_USER_AGENT || 'my-tg-agent/1.0';
export const RSS_ANALYZER_MAX_RETRY_TIMES = Number(process.env.RSS_ANALYZER_MAX_RETRY_TIMES || 3);
export const RSS_ANALYZER_RETRY_BASE_DELAY_MS = Number(
  process.env.RSS_ANALYZER_RETRY_BASE_DELAY_MS || 2000,
);

export const TG_MESSAGE_THREAD_ID: Record<string, string> = {
  NEWS_REPORT: process.env.TG_NEWS_REPORT_THREAD_ID!,
  WEATHER: process.env.TG_WEATHRE_THREAD_ID!,
  STOCK: process.env.TG_STOCK_THREAD_ID!,
  SEC_FILING: process.env.TG_SEC_FILING_THREAD_ID!,
};
