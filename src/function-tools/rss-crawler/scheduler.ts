import cron from 'node-cron';
import { CRAWLER_CATEGORIES } from './config';
import { fetchAndParseRSS } from '@/function-tools/rss-feed/parser';
import { rssDB, articleDB } from '../../utils/sqlite/sqlite';

export function bootstrapCrawler() {
  console.log('Bootstrapping Crawler Engine...');

  const activeCategories = Object.keys(CRAWLER_CATEGORIES);

  activeCategories.forEach((category) => {
    const cronSchedule = CRAWLER_CATEGORIES[category];

    if (!cron.validate(cronSchedule)) {
      console.error(`Invalid cron schedule for category ${category}: ${cronSchedule}`);
      return;
    }

    // 设置 node-cron 定时任务
    cron.schedule(cronSchedule, async () => {
      console.log(`[Crawler] Starting category task: ${category}`);

      // 1. 获取这个类别下的所有订阅源
      const subscriptions = rssDB.getAllSubscriptions();
      const targetSubs = subscriptions.filter((sub) => sub.category === category);

      if (targetSubs.length === 0) {
        console.log(`[Crawler] No subscriptions found for category: ${category}`);
        return;
      }

      // 2. 遍历拉取内容
      for (const sub of targetSubs) {
        console.log(`[Crawler] Fetching RSS: ${sub.title} - ${sub.url}`);
        const feed = await fetchAndParseRSS(sub.url);

        if (!feed || !feed.items || feed.items.length === 0) {
          console.warn(`[Crawler] Fetch failed or no items for: ${sub.url}`);
          continue;
        }

        // 3. 解析与按篇去重入库
        let newItemsCount = 0;

        for (const item of feed.items) {
          const guid = item.guid || item.id || item.link || '';
          if (!guid) continue; // 跳过没有标识符的数据

          const isNew = articleDB.saveArticle({
            feed_url: sub.url,
            guid: guid,
            title: item.title || 'No Title',
            link: item.link || sub.url,
            content: item.content || item.contentSnippet || '',
            pub_date: item.pubDate || new Date().toISOString(),
            category: sub.category || 'General',
          });

          if (isNew) {
            newItemsCount++;
            // 这里可以对接预备发给 LLM 分析的消息队列，或者简单日志打印
            console.log(`[Crawler] New Article Discovered: ${item.title}`);
          }
        }

        console.log(`[Crawler] Finished ${sub.url}. Discovered ${newItemsCount} new articles.`);

        // 更新订阅列表里最后抓取时间的状态
        rssDB.updateLastFetched(sub.url);
      }
    });

    console.log(`[Crawler] Scheduled task for category '${category}' with cron '${cronSchedule}'`);
  });
}

export function bootstrapCleanup(expireDays: number) {
  console.log(
    `[Cleanup] Bootstrapping DB cleanup scheduler. Expiration set to ${expireDays} days.`,
  );

  // 1. 启动时立即执行一次清理
  if (articleDB.hasTable()) {
    console.log(`[Cleanup] Initial cleanup started...`);
    const deletedCount = articleDB.deleteOldArticles(expireDays);
    console.log(`[Cleanup] Initial cleanup executed. Deleted ${deletedCount} old articles.`);
  } else {
    console.log(`[Cleanup] 'articles' table not found yet. Skipping initial cleanup.`);
  }

  // 2. 每天凌晨 0 点执行清理
  cron.schedule('0 0 * * *', () => {
    console.log(`[Cleanup] Running scheduled daily cleanup...`);
    if (articleDB.hasTable()) {
      const count = articleDB.deleteOldArticles(expireDays);
      console.log(`[Cleanup] Scheduled cleanup completed. Deleted ${count} old articles.`);
    }
  });
}
