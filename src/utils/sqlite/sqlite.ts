import Database from 'better-sqlite3';
import { join } from 'path';
import { SQLITE_DB_PATH } from '../config';
import { RSSDatabase } from './rss-sub';

const dbPath = join(process.cwd(), SQLITE_DB_PATH);
const db = new Database(dbPath);

export const rssDB = new RSSDatabase(db);

