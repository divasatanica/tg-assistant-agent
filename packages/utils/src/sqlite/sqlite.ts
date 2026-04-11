import { Database } from 'bun:sqlite';
import { join } from 'path';
import { SQLITE_DB_PATH } from '../config';
import { RSSDatabase } from './rss-sub';

const dbPath = join(process.cwd(), SQLITE_DB_PATH);
const db = new Database(dbPath);

// 开启 WAL 模式 (Write-Ahead Logging) 并设置忙碌超时
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA busy_timeout = 5000');

export const rssDB = new RSSDatabase(db);
