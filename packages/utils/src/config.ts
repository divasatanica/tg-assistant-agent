import dotenv from 'dotenv';

dotenv.config();

export const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN!;
export const OLLAMA_MODEL_NAME = process.env.OLLAMA_MODEL_NAME!;
export const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH!;
export const TELEGRAM_PERSONAL_CHAT_ID = process.env.TG_PERSONAL_CHAT_ID!;
export const GOOGLE_MODEL_NAME = process.env.GOOGLE_MODEL_NAME!;
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;
