import { logger } from '@krobert/utils';
import { XbrlMetrics } from '../xbrl-extractor';
import { AgentState } from '../global';
import { getCompanyFacts } from '../edgar-client';
import { extractKeyMetrics } from '../xbrl-extractor';

export const fetchXbrlNode = async (state: typeof AgentState.State) => {
  const xbrlMetrics: Record<string, XbrlMetrics[]> = {};
  const processedCiks = new Set<string>();

  for (const [ticker, filingList] of Object.entries(state.filings ?? {})) {
    const cik = filingList[0]?.cik;
    if (!cik || processedCiks.has(cik)) continue;
    processedCiks.add(cik);

    try {
      const factsData = await getCompanyFacts(cik);
      const metrics = extractKeyMetrics(ticker, factsData, 3);
      if (metrics.length > 0) {
        xbrlMetrics[ticker] = metrics;
        logger.info(
          `[SEC Agent] XBRL metrics for ${ticker}: ${metrics.map((m) => `FY${m.fiscalYear} (${Object.keys(m.facts).length} metrics)`).join(', ')}`,
        );
      } else {
        logger.warn(`[SEC Agent] No XBRL metrics extracted for ${ticker}`);
      }
    } catch (err) {
      logger.error(`[SEC Agent] Failed to fetch XBRL facts for ${ticker}`, err);
    }
  }

  return { xbrlMetrics };
};
