import { bootstrapRssAnalysisCron } from './rss-analysis';
import { bootstrapSecFilingCron } from './sec-filing-analysis';
import { bootstrapWeatherCron } from './weather';

export function startCron() {
  bootstrapRssAnalysisCron();
  // bootstrapSecFilingCron();
  // bootstrapSecMonitorCron();
  // bootstrapWeatherCron();
}
