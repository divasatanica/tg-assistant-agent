import { logger } from '@krobert/utils';
import { AgentState, ParsedSection } from '../global';
import { fetchFilingHtml } from '../edgar-client';
import { parseFilingHtml } from '../filing-parser';

export const extractSectionsNode = async (state: typeof AgentState.State) => {
  const sections: Record<string, ParsedSection[]> = {};

  for (const [ticker, filingList] of Object.entries(state.filings ?? {})) {
    const tickerSections: ParsedSection[] = [];

    for (const filing of filingList) {
      try {
        const html = await fetchFilingHtml(parseInt(filing.cik, 10), filing.accessionNumber);
        const parsed = parseFilingHtml(html, filing.formType);
        parsed.forEach((s) => {
          tickerSections.push({
            label: `[${filing.formType} ${filing.reportDate}] ${s.label}`,
            text: s.text,
          });
        });
      } catch (err) {
        logger.error(`[SEC Agent] Failed to parse ${filing.formType} for ${ticker}`, err);
      }
    }

    if (tickerSections.length > 0) {
      sections[ticker] = tickerSections;
      logger.info(`[SEC Agent] Extracted ${tickerSections.length} section(s) for ${ticker}`);
    }
  }

  return { sections };
};
