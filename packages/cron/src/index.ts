import { bootstrapRssAnalysisCron } from './rss-analysis';
import { bootstrapWeatherCron } from './weather';

export function startCron() {
  bootstrapRssAnalysisCron();
  // bootstrapWeatherCron();
}
