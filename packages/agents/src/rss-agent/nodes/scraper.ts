import { rssDB } from '@krobert/utils/sqlite/sqlite';
import {
  EVENT_MESSAGE_CHANNEL_SEND_MESSAGE,
  formatTime,
  logger,
  MESSAGE_CHANNEL,
  TELEGRAM_PERSONAL_CHAT_ID,
  TG_MESSAGE_THREAD_ID,
} from '@krobert/utils';
import { messageChannel } from '@krobert/channel/message-channel';

import { AgentState } from '../global';
import { fetchAndParseRSS, resolveRssFeed } from '@krobert/function-tools/rss-feed';
import Parser from 'rss-parser';

import { sendRawMessage } from '@krobert/channel/telegram/message';
import { bot } from '@krobert/channel/telegram/telegraf';

function formatNewList(rssData: Record<string, any[]>) {
  const output = {} as Record<string, string>;

  Object.keys(rssData).forEach((key) => {
    output[key] = `## ${key}\n`;
    rssData[key].forEach((rss: any) => {
      if (rss.items.length === 0) {
        return;
      }
      const creator = rss.items[0]?.creator;
      if (key === 'Blog') {
        output[key] += `### ${creator}\n`;
      }
      const items = rss.items.slice(0, 3);
      items.forEach((item: any) => {
        output[key] +=
          `- ${formatTime(new Date(item.pubDate), { format: 'yyyy-MM-dd HH:mm' })} [${item.title}](${item.link})\n `;
      });

      output[key] = output[key].slice(0, 4000);
    });
  });

  return output;
}

const filterTooOld = (category: string) => (item: Parser.Item) => {
  const pubDate = new Date(item.pubDate!);
  const now = new Date();
  const diff = now.getTime() - pubDate.getTime();
  const TTLDays =
    {
      News: 2,
      Blog: 7,
      General: 7,
    }[category] || 7;
  const TTL = TTLDays * 24 * 60 * 60 * 1000;
  return diff < TTL;
};

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
      acc[category].push({
        items: items.slice(0, 20).filter(filterTooOld(category)),
        description,
        link,
        title,
      });
      return acc;
    },
    {} as Record<string, Array<Parser.Output<any>>>,
  );

  logger.debug('[RSSAgent] concatedData', concatedData);
  await sendRawMessage(
    bot,
    state.tgExtra?.chatId ?? TELEGRAM_PERSONAL_CHAT_ID,
    `已抓取类别: ${categories.join(', ')}`,
    state.tgExtra?.threadId ?? Number(TG_MESSAGE_THREAD_ID.NEWS_REPORT),
  );

  const messageSummary = formatNewList(concatedData);
  logger.debug('[RSSAgent] messageSummary', messageSummary);
  const messages = Object.keys(messageSummary).map((key) => messageSummary[key]);

  messageChannel.emit(EVENT_MESSAGE_CHANNEL_SEND_MESSAGE, {
    channel: MESSAGE_CHANNEL.TELEGRAM,
    messages,
    extra: {
      tgExtra: {
        chatId: state.tgExtra?.chatId,
        threadId: state.tgExtra?.threadId ?? TG_MESSAGE_THREAD_ID.NEWS_REPORT,
      },
    },
  });

  return { rssData: concatedData };
};
