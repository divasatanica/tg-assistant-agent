export const CRAWLER_CATEGORIES: Record<string, string> = {
  'News': '*/30 * * * *', // 每 30 分钟拉取一次
  'Finance': '*/30 * * * *', // 每 30 分钟拉取一次
  'General': '0 * * * *', // 每 1 小时拉取一次
  'Blog': '0 12 * * *', // 每天中午 12:00 拉取一次
};
