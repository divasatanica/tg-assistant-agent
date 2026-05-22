import { logger } from '@krobert/utils';
import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';
import { AgentState, FilingMetadata } from '../global';
import {
  buildFilingArchiveUrls,
  getTickerCikMap,
  cikTo10Digits,
  getSubmissions,
} from '../edgar-client';
// Foreign issuers file 20-F (annual, like 10-K) and 6-K (quarterly/events, like 10-Q/8-K).
const FOREIGN_FALLBACK_FORMS = ['20-F', '40-F', '6-K'];

export const fetchFilingsNode = async (state: typeof AgentState.State) => {
  const { tickers, formTypes = ['10-K'], maxFilingsPerTicker = 1 } = state;

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

      for (
        let i = 0;
        i < recent.accessionNumber.length && matched.length < maxFilingsPerTicker;
        i++
      ) {
        logger.debug(
          `[SEC Agent] Checking filing ${recent.form[i]} filed on ${recent.filingDate[i]}..., formTypes: ${formTypes.join(',')}`,
        );
        if (!formTypes.includes(recent.form[i])) continue;

        const archiveUrls = buildFilingArchiveUrls(
          entry.cik_str,
          recent.accessionNumber[i],
          recent.primaryDocument[i],
        );

        matched.push({
          ticker: ticker.toUpperCase().trim(),
          cik: cik10,
          formType: recent.form[i],
          filingDate: recent.filingDate[i],
          reportDate: recent.reportDate[i],
          accessionNumber: recent.accessionNumber[i],
          primaryDocument: recent.primaryDocument[i],
          htmlUrl: archiveUrls.primaryDocumentUrl ?? archiveUrls.filingIndexHtmlUrl,
        });
      }

      if (matched.length > 0) {
        filings[ticker.toUpperCase().trim()] = matched;
        logger.info(
          `[SEC Agent] Found ${matched.length} filing(s) for ${ticker}: ${matched.map((f) => `${f.formType} (${f.reportDate})`).join(', ')}`,
        );
      } else {
        // 国内表单找不到 → 尝试 Foreign Private Issuer 表单 (20-F, 6-K)
        const foreignFormSet = FOREIGN_FALLBACK_FORMS.filter((f) => !formTypes.includes(f));
        if (foreignFormSet.length > 0) {
          logger.info(
            `[SEC Agent] No ${formTypes.join(',')} filings for ${ticker}, trying foreign issuer forms: ${foreignFormSet.join(', ')}`,
          );
          for (
            let i = 0;
            i < recent.accessionNumber.length && matched.length < maxFilingsPerTicker;
            i++
          ) {
            if (!foreignFormSet.includes(recent.form[i])) continue;

            const archiveUrls = buildFilingArchiveUrls(
              entry.cik_str,
              recent.accessionNumber[i],
              recent.primaryDocument[i],
            );

            matched.push({
              ticker: ticker.toUpperCase().trim(),
              cik: cik10,
              formType: recent.form[i],
              filingDate: recent.filingDate[i],
              reportDate: recent.reportDate[i],
              accessionNumber: recent.accessionNumber[i],
              primaryDocument: recent.primaryDocument[i],
              htmlUrl: archiveUrls.primaryDocumentUrl ?? archiveUrls.filingIndexHtmlUrl,
            });
          }

          if (matched.length > 0) {
            filings[ticker.toUpperCase().trim()] = matched;
            logger.info(
              `[SEC Agent] Found ${matched.length} foreign filing(s) for ${ticker}: ${matched.map((f) => `${f.formType} (${f.reportDate})`).join(', ')}`,
            );
          } else {
            logger.info(
              `[SEC Agent] No matching filings (${[...formTypes, ...foreignFormSet].join(',')}) for ${ticker}`,
            );
          }
        } else {
          logger.info(`[SEC Agent] No matching filings (${formTypes.join(',')}) for ${ticker}`);
        }
      }
    } catch (err) {
      logger.error(`[SEC Agent] Failed to fetch filings for ${ticker}`, err);
    }
  }

  // Domestic vs Foreign Private Issuer form type mapping.
  const allUrls: string[] = [];
  for (const [ticker, tickerFilings] of Object.entries(filings)) {
    const urls = tickerFilings.map((f) => f.htmlUrl).filter(Boolean);
    if (urls.length > 0) {
      const firstHalf = urls.slice(0, Math.ceil(urls.length / 2)).join('\n');
      const secondHalf = urls.slice(Math.ceil(urls.length / 2)).join('\n');
      if (firstHalf) allUrls.push(`${ticker} SEC Filing 链接:\n${firstHalf} \n (1/2)`);
      if (secondHalf) allUrls.push(`${ticker} SEC Filing 链接:\n${secondHalf} \n (2/2)`);
    }

    logger.debug(`[SEC Agent] Collected URLs for ${ticker}: ${JSON.stringify(allUrls).length - 2}`);
  }

  if (allUrls.length > 0 && state.tgExtra) {
    eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
      channel: 'telegram',
      messages: allUrls,
      extra: {
        tgExtra: {
          chatId: state.tgExtra.chatId,
          threadId: state.tgExtra.threadId,
          replyToMessageId: state.tgExtra.replyToMessageId,
        },
      },
    });
  }

  return { filings };
};
