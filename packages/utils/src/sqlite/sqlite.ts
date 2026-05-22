import { Database } from 'bun:sqlite';
import { join } from 'path';
import { SQLITE_DB_PATH } from '../config';
import { RSSDatabase } from './rss-sub';

let _db: Database | null = null;
let _rssDB: RSSDatabase | null = null;

function getDb(): Database {
  if (!_db) {
    const dbPath = join(process.cwd(), SQLITE_DB_PATH);
    _db = new Database(dbPath);
    _db.run('PRAGMA journal_mode = WAL');
    _db.run('PRAGMA busy_timeout = 5000');
  }
  return _db;
}

export const rssDB: RSSDatabase = new Proxy({} as RSSDatabase, {
  get(_, prop: string | symbol) {
    if (!_rssDB) _rssDB = new RSSDatabase(getDb());
    return Reflect.get(_rssDB, prop, _rssDB);
  },
});
