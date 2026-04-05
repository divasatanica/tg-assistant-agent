import Database from 'better-sqlite3';

export interface Article {
  id?: number;
  feed_url: string; // 来源于哪个 RSS url
  guid: string;     // 每篇文章的唯一标识符
  title: string;
  link: string;     // 文章原始链接
  content?: string; // 全文/摘要内容
  pub_date?: string;// 发布时间
  created_at?: string;
  category: string;
}

export class ArticleDatabase {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.init();
  }

  private init() {
    // guid 通常是 RSS 每个 item 最可靠的唯一键，但有时没有，退化为 link。
    // 为确保万无一失，同一个订阅下的 (feed_url, guid) 约束唯一。
    const query = `
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_url TEXT NOT NULL,
        guid TEXT NOT NULL,
        title TEXT NOT NULL,
        link TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT,
        pub_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(feed_url, guid)
      );
    `;
    this.db.exec(query);
  }

  /**
   * 保存抓取的文章。如果已存在，则忽略从而实现排重。
   * @returns true 如果是新文章被插入，否则 false
   */
  saveArticle(article: Article): boolean {
    // SQLite 的 INSERT OR IGNORE 发生冲突时什么也不做
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO articles (feed_url, guid, title, link, content, pub_date, category)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        article.feed_url,
        article.guid,
        article.title,
        article.link,
        article.content || null,
        article.pub_date || null,
        article.category
      );
      // 如果 changes > 0，说明插入成功，未触发 unique constraint
      return info.changes > 0;
    } catch (error) {
      console.error('Error saving article:', error);
      return false;
    }
  }

  getAllArticles(): Article[] {
    const stmt = this.db.prepare('SELECT * FROM articles ORDER BY created_at DESC');
    return stmt.all() as Article[];
  }

  deleteOldArticles(days: number): number {
    const stmt = this.db.prepare(`
      DELETE FROM articles
      WHERE created_at <= datetime('now', ?)
    `);
    const info = stmt.run(`-${days} days`);
    return info.changes;
  }

  hasTable(): boolean {
    const stmt = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='articles'");
    const row = stmt.get();
    return !!row;
  }
}
