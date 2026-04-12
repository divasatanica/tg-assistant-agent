import { rssDB } from '@krobert/utils/sqlite/sqlite';
import { logger } from '@krobert/utils';

import { AgentState } from '../global';
import { fetchAndParseRSS, resolveRssFeed } from '@krobert/function-tools/rss-feed';
import Parser from 'rss-parser';

// 节点 1: 抓取数据
export const scraperNode = async (state: typeof AgentState.State) => {
  const _rssList = rssDB.getAllSubscriptions();

  const categories = state.categories;
  const rssList = _rssList.filter((rss) => categories.includes(rss.category!));

  logger.info('[RSSAgent] rsslist', rssList);

  const data = await Promise.all(
    rssList.map(async (rss) => {
      const url = resolveRssFeed(rss.url, rss.subscription_type || 'raw');
      const data = await fetchAndParseRSS(url);
      return data;
    }),
  );

  const concatedData = rssList.reduce(
    (acc, rss, index) => {
      const category = rss.category || 'General';
      if (!acc[category]) {
        acc[category] = [];
      }
      if (data[index] == null) {
        return acc;
      }
      const { items, description, link, title = rss.title } = data[index]!;
      acc[category].push({ items: items.slice(0, 5), description, link, title });
      return acc;
    },
    {} as Record<string, Array<Parser.Output<any>>>,
  );

  logger.info('[RSSAgent] concatedData', concatedData);

  return { rssData: concatedData };
};
