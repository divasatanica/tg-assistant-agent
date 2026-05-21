import { logger } from '@krobert/utils';
import { AgentState, FilingMetadata } from '../global';
import { getTickerCikMap, cikTo10Digits, getSubmissions } from '../edgar-client';

export const fetchFilingsNode = async (state: typeof AgentState.State) => {
  const { tickers } = state;
  const stateExtra = state as unknown as Record<string, unknown>;
  const formTypes: string[] = (stateExtra._formTypes as string[]) ?? ['10-K'];
  const maxFilings: number = (stateExtra._maxFilingsPerTicker as number) ?? 1;

  if (!tickers || tickers.length === 0) {
    logger.warn('[SEC Agent] No tickers provided');
    return { filings: {} };
  }

  const tickerMap = await getTickerCikMap();
  const filings: Record<string, FilingMetadata[]> = {};

  for (const ticker of tickers) {
    const entry = tickerMap.get(ticker.toUpperCase().trim());
    if (!entry) {
      logger.warn(`[SEC Agent] Ticker "${ticker}" not found in SEC company tickers`);
      continue;
    }

    const cik10 = cikTo10Digits(entry.cik_str);
    try {
      logger.debug(`[SEC Agent] Fetching filings for ${ticker} (CIK: ${cik10})...`);
      const submissions = await getSubmissions(cik10);

      logger.debug(`[SEC Agent] Processing filings for ${submissions.filings}...`);
      const recent = submissions.filings.recent;
      const matched: FilingMetadata[] = [];

      for (let i = 0; i < recent.accessionNumber.length && matched.length < maxFilings; i++) {
        if (!formTypes.includes(recent.form[i])) continue;

        matched.push({
          ticker: ticker.toUpperCase().trim(),
          cik: cik10,
          formType: recent.form[i],
          filingDate: recent.filingDate[i],
          reportDate: recent.reportDate[i],
          accessionNumber: recent.accessionNumber[i],
          primaryDocument: recent.primaryDocument[i],
          htmlUrl: `https://www.sec.gov/Archives/edgar/data/${entry.cik_str}/${recent.accessionNumber[i].replace(/-/g, '')}/${recent.primaryDocument[i]}`,
        });
      }

      if (matched.length > 0) {
        filings[ticker.toUpperCase().trim()] = matched;
        logger.info(
          `[SEC Agent] Found ${matched.length} filing(s) for ${ticker}: ${matched.map((f) => `${f.formType} (${f.reportDate})`).join(', ')}`,
        );
      } else {
        logger.info(`[SEC Agent] No matching filings (${formTypes.join(',')}) for ${ticker}`);
      }
    } catch (err) {
      logger.error(`[SEC Agent] Failed to fetch filings for ${ticker}`, err);
    }
  }

  return { filings };
};
