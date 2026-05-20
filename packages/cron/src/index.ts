import { bootstrapRssAnalysisCron } from './rss-analysis';
import { bootstrapSecFilingCron } from './sec-filing-analysis';
import { bootstrapSecMonitorCron } from './sec-monitor';
import { bootstrapWeatherCron } from './weather';

export function startCron() {
  bootstrapRssAnalysisCron();
  bootstrapSecFilingCron();
  // bootstrapSecMonitorCron();
  // bootstrapWeatherCron();
}
