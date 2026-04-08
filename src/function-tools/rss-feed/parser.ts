import Parser from 'rss-parser';

// 定义我们想要提取的自定义字段或标准 RSS 字段
type CustomFeed = { title: string };
type CustomItem = {
  guid?: string;
  id?: string;
  link: string;
  pubDate?: string;
  title: string;
  contentSnippet?: string;
  content?: string;
};

const parser = new Parser<CustomFeed, CustomItem>({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'max-age=0',
  },
});

export function resolveRssFeed(url: string, subType: string) {
  switch (subType) {
    case 'rsshub': {
      const domain = process.env.RSSHUB_DOMAIN;
      if (!domain) {
        throw new Error('RSSHUB_DOMAIN is not defined');
      }
      return `${domain}${url}`;
    }
    case 'raw': {
      return url;
    }
    default: {
      return url;
    }
  }
}

export async function fetchAndParseRSS(url: string): Promise<Parser.Output<CustomItem> | null> {
  try {
    const feed = await parser.parseURL(url);
    return feed;
  } catch (error) {
    console.error(`Error fetching or parsing RSS for url [${url}]:`, error);
    return null;
  }
}
