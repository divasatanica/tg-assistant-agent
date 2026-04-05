import Database from 'better-sqlite3';
import { join } from 'path';
import { SQLITE_DB_PATH } from '../config';
import { RSSDatabase } from './rss-sub';
import { ArticleDatabase } from './article';

const dbPath = join(process.cwd(), SQLITE_DB_PATH);
// 设置 timeout 避免被其他查询锁住瞬间导致直接报错，允许它多等等
const db = new Database(dbPath, { timeout: 5000 });

// 开启 WAL 模式 (Write-Ahead Logging)，显著加强并发情况下的读写性能与避免死锁
db.pragma('journal_mode = WAL');

export const rssDB = new RSSDatabase(db);
export const articleDB = new ArticleDatabase(db);
