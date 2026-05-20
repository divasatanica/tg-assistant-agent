import { bootstrapRssAnalysisCron } from './rss-analysis';
import { bootstrapSecFilingCron } from './sec-filing-analysis';

export function startCron() {
  bootstrapRssAnalysisCron();
  bootstrapSecFilingCron();
  // bootstrapWeatherCron();
}
