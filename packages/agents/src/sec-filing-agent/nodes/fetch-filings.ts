import { EVENT_MESSAGE_CHANNEL_SEND_MESSAGE, MESSAGE_CHANNEL, logger } from '@krobert/utils';
import { messageChannel } from '@krobert/channel/message-channel';
import { AgentState, FilingMetadata } from '../global';
import {
  buildFilingArchiveUrls,
  getTickerCikMap,
  cikTo10Digits,
  getSubmissions,
} from '../edgar-client';

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
        logger.info(`[SEC Agent] No matching filings (${formTypes.join(',')}) for ${ticker}`);
      }
    } catch (err) {
      logger.error(`[SEC Agent] Failed to fetch filings for ${ticker}`, err);
    }
  }

  // 收集所有找到的 Filing URL，发送给用户
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
    messageChannel.emit(EVENT_MESSAGE_CHANNEL_SEND_MESSAGE, {
      channel: MESSAGE_CHANNEL.TELEGRAM,
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
