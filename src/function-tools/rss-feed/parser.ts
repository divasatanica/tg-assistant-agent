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
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
  },
});

export async function fetchAndParseRSS(url: string): Promise<Parser.Output<CustomItem> | null> {
  try {
    const feed = await parser.parseURL(url);
    return feed;
  } catch (error) {
    console.error(`Error fetching or parsing RSS for url [${url}]:`, error);
    return null;
  }
}
