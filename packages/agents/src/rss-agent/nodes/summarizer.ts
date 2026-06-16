import {
  logger,
  parseMessageContent,
  TELEGRAM_PERSONAL_CHAT_ID,
  TG_MESSAGE_THREAD_ID,
  LARK_USER_OPEN_ID,
  ACTIVE_CHANNELS,
} from '@krobert/utils';
import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';
import type { ChannelTarget } from '@krobert/events';
import { extractArticleContent } from '@krobert/function-tools/article-readability';
import { AgentState, ArticleSummary, summarizerModel } from '../global';

const FETCH_CONCURRENCY = 3;

function semaphore(limit: number) {
  let running = 0;
  const queue: Array<() => void> = [];
  const release = () => {
    running--;
    const next = queue.shift();
    if (next) next();
  };
  const acquire = (): Promise<void> => {
    if (running < limit) {
      running++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      queue.push(() => {
        running++;
        resolve();
      });
    });
  };
  return { acquire, release };
}

function buildChannelTargets(channels: Array<'telegram' | 'feishu'>): ChannelTarget[] {
  const targets: ChannelTarget[] = [];
  for (const ch of channels) {
    if (ch === 'telegram') {
      targets.push({
        channel: 'telegram',
        chatId: TELEGRAM_PERSONAL_CHAT_ID,
        threadId: Number(TG_MESSAGE_THREAD_ID.NEWS_REPORT),
      });
    } else if (ch === 'feishu') {
      if (!LARK_USER_OPEN_ID) continue;
      targets.push({
        channel: 'feishu',
        chatId: LARK_USER_OPEN_ID,
        receiveIdType: 'open_id',
      });
    }
  }
  return targets;
}

async function fetchArticleText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const html = await res.text();
    const article = extractArticleContent(html, url);
    const text = article?.textContent?.trim();
    return text && text.length > 50 ? text : null;
  } catch {
    return null;
  }
}

export const summarizerNode = async (state: typeof AgentState.State) => {
  const { rssData } = state;

  const isEmpty =
    Object.keys(rssData).length === 0 ||
    Object.values(rssData).every((feeds) => feeds.length === 0);

  if (isEmpty) {
    return { articleSummaries: {} };
  }

  logger.info('[RSSAgent] Starting article summarization (per-feed batching)...');

  const articleSummaries: Record<string, ArticleSummary[]> = {};

  for (const [category, feeds] of Object.entries(rssData)) {
    const categorySummaries: ArticleSummary[] = [];

    for (const feed of feeds) {
      const items = feed.items ?? [];
      if (items.length === 0) continue;

      // 1. 并获取所有文章正文（仅限制 fetch 并发，不调 LLM）
      const fetchLimiter = semaphore(FETCH_CONCURRENCY);
      const articlesWithText = await Promise.all(
        items.map(async (item) => {
          await fetchLimiter.acquire();
          try {
            const articleText = await fetchArticleText(item.link);
            const sourceText = articleText ?? item.contentSnippet ?? '';
            return {
              title: item.title as string,
              link: item.link as string,
              pubDate: item.pubDate as string | undefined,
              text: sourceText,
            };
          } catch {
            return {
              title: item.title as string,
              link: item.link as string,
              pubDate: item.pubDate as string | undefined,
              text: item.contentSnippet ?? '',
            };
          } finally {
            fetchLimiter.release();
          }
        }),
      );

      const validArticles = articlesWithText.filter((a) => a.title && a.link && a.text.length > 0);

      if (validArticles.length === 0) continue;

      // 2. 将同一订阅源的所有文章打包成一次 LLM 请求
      const feedTitle = (feed as any).title || 'Unknown Feed';
      const articlesBlock = validArticles
        .map((a, i) => `[文章 ${i + 1}]\n标题：${a.title}\n正文：${a.text.slice(0, 5000)}`)
        .join('\n\n');

      const prompt = `你是一个专业的中文新闻编辑。以下是来自「${feedTitle}」的 ${validArticles.length} 篇文章。请为每篇文章生成一句或两句中文摘要，只输出核心事实和关键结论，不要评价。

严格按以下格式输出，每篇文章之间用分隔线隔开：

=====ARTICLE_1=====
<这里写第一篇文章的中文摘要>
=====ARTICLE_2=====
<这里写第二篇文章的中文摘要>
...以此类推

注意：
- 摘要必须使用简体中文，绝对不要输出英文
- 每篇文章只输出一个分隔线和一段摘要，不要输出标题
- 严格按照文章顺序依次输出

以下是文章内容：

${validArticles.map((item) => `[文章 ${validArticles.indexOf(item) + 1}]\n标题：${item.title}\n正文：${item.text.slice(0, 5000)}`).join('\n\n')}`;

      logger.info(
        `[RSSAgent] Summarizing ${validArticles.length} articles from "${feedTitle}" in one batch`,
      );

      logger.debug(`[RSSAgent] Summarizer prompt for "${validArticles[0].text.slice(0, 30)}..."`);

      try {
        const res = await summarizerModel.invoke([['user', prompt]]);
        const rawOutput = parseMessageContent(res.content);

        logger.debug(`[RSSAgent] Raw summarizer output for "${feedTitle}":\n${rawOutput}`);

        // 3. 按 =====ARTICLE_N===== 分隔符解析
        const separatorRe = /={5}ARTICLE_(\d+)={5}/g;
        const matches = [...rawOutput.matchAll(separatorRe)];

        for (let m = 0; m < matches.length; m++) {
          const idx = parseInt(matches[m][1], 10) - 1;
          const article = validArticles[idx];
          if (!article) continue;

          // 取当前分隔符到下一个分隔符（或文本末尾）之间的内容
          const start = matches[m].index! + matches[m][0].length;
          const end = m < matches.length - 1 ? matches[m + 1].index! : rawOutput.length;
          const summary = rawOutput.slice(start, end).trim();

          if (summary.length > 0) {
            categorySummaries.push({
              title: article.title,
              link: article.link,
              summary: summary.slice(0, 600),
              pubDate: article.pubDate,
            });
          }
        }

        // 如果解析结果少于文章数，fill gaps
        if (categorySummaries.length < validArticles.length) {
          logger.warn(
            `[RSSAgent] Parsed ${categorySummaries.length}/${validArticles.length} summaries from "${feedTitle}", filling gaps`,
          );
          const covered = new Set(matches.map((m) => parseInt(m[1], 10) - 1).filter((i) => i >= 0));
          for (let i = 0; i < validArticles.length; i++) {
            if (!covered.has(i)) {
              categorySummaries.push({
                title: validArticles[i].title,
                link: validArticles[i].link,
                summary: validArticles[i].text.slice(0, 300),
                pubDate: validArticles[i].pubDate,
              });
            }
          }
        }
      } catch (err) {
        logger.error(`[RSSAgent] Batch summarization failed for "${feedTitle}"`, err);
        // 降级：取正文前 300 字
        for (const a of validArticles) {
          categorySummaries.push({
            title: a.title,
            link: a.link,
            summary: a.text.slice(0, 300),
            pubDate: a.pubDate,
          });
        }
      }
    }

    if (categorySummaries.length > 0) {
      articleSummaries[category] = categorySummaries;
    }
  }

  const totalSummaries = Object.values(articleSummaries).flat().length;
  logger.info(`[RSSAgent] Summarization complete: ${totalSummaries} articles`);

  // 发送摘要列表到 ACTIVE_CHANNELS
  const channels = state.channelExtra?.channels ?? ACTIVE_CHANNELS;
  const targets = buildChannelTargets(channels);

  const summaryMessages: string[] = [];
  for (const [category, summaries] of Object.entries(articleSummaries)) {
    if (summaries.length === 0) continue;
    let msg = `## ${category} 文章摘要\n\n`;
    for (const s of summaries) {
      msg += `- ${s.summary}\n`;
    }
    summaryMessages.push(msg.slice(0, 4000));
  }

  if (summaryMessages.length > 0) {
    eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, { targets, messages: summaryMessages });
  }

  return { articleSummaries };
};
