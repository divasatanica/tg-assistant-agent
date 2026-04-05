import dotenv from 'dotenv';

dotenv.config();

export const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN!;
export const OLLAMA_MODEL_NAME = process.env.OLLAMA_MODEL_NAME!;
export const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH!;