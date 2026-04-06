import Database from 'better-sqlite3';

// 定义订阅项的类型
export interface RSSSubscription {
  id?: number;
  url: string;
  title: string;
  category?: string;
  last_fetched?: string; // ISO 格式时间
  created_at?: string;
}

export class RSSDatabase {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.init();
  }

  private init() {
    // 2. 创建表结构
    // url 设置为 UNIQUE 防止重复订阅
    const query = `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        category TEXT,
        last_fetched DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    this.db.exec(query);
  }

  // 3. 添加订阅
  addSubscription(url: string, title: string, category: string = 'General'): boolean {
    try {
      const stmt = this.db.prepare(
        'INSERT INTO subscriptions (url, title, category) VALUES (?, ?, ?)',
      );
      stmt.run(url, title, category);
      return true;
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        console.warn(`URL 已存在: ${url}`);
        return false;
      }
      throw error;
    }
  }

  // 4. 获取所有订阅
  getAllSubscriptions(): RSSSubscription[] {
    const stmt = this.db.prepare('SELECT * FROM subscriptions');
    return stmt.all() as RSSSubscription[];
  }

  // 5. 更新抓取时间 (用于增量更新判断)
  updateLastFetched(url: string) {
    const stmt = this.db.prepare('UPDATE subscriptions SET last_fetched = ? WHERE url = ?');
    stmt.run(new Date().toISOString(), url);
  }

  // 6. 删除订阅
  removeSubscription(url: string) {
    const stmt = this.db.prepare('DELETE FROM subscriptions WHERE url = ?');
    stmt.run(url);
  }

  close() {
    this.db.close();
  }
}
