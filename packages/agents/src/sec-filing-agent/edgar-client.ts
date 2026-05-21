import { logger, SEC_USER_AGENT } from '@krobert/utils';

const SEC_BASE = 'https://www.sec.gov';
const SEC_DATA = 'https://data.sec.gov';

// Per-domain rate limits. data.sec.gov tolerates ~10 req/s, but
// www.sec.gov /Archives aggressively throttles and needs more spacing.
const DOMAIN_MIN_INTERVAL: Record<string, number> = {
  'data.sec.gov': 200,
  'www.sec.gov': 600,
};
const DEFAULT_MIN_INTERVAL = 400;

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

// ── Per-domain rate limiter ──────────────────────────────────────────

const lastRequestTime: Record<string, number> = {};

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'www.sec.gov';
  }
}

async function throttle(domain: string): Promise<void> {
  const minInterval = DOMAIN_MIN_INTERVAL[domain] ?? DEFAULT_MIN_INTERVAL;
  const last = lastRequestTime[domain] ?? 0;
  const now = Date.now();
  const elapsed = now - last;
  if (elapsed < minInterval) {
    await new Promise((r) => setTimeout(r, minInterval - elapsed));
  }
  lastRequestTime[domain] = Date.now();
}

// ── Fetch with retry + backoff ───────────────────────────────────────

async function rateLimitedFetch(
  url: string,
  accept = 'application/json',
  retries = MAX_RETRIES,
): Promise<Response> {
  const domain = getDomain(url);

  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle(domain);

    const response = await fetch(url, {
      headers: {
        'User-Agent': SEC_USER_AGENT,
        Accept: accept,
      },
    });

    // 429 / 503 are transient server-side throttling — retry with backoff
    if ((response.status === 429 || response.status === 503) && attempt < retries) {
      const retryAfter = response.headers.get('Retry-After');
      const delayMs = retryAfter ? Number(retryAfter) * 1000 : RETRY_BASE_DELAY_MS * 2 ** attempt;

      logger.warn(
        `[EdgarClient] ${response.status} for ${url}, retrying (${attempt + 1}/${retries}) in ${delayMs}ms`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '[unreadable]');
      throw new Error(`SEC API ${response.status} for ${url}: ${body.slice(0, 300)}`);
    }

    return response;
  }

  throw new Error(`SEC API exhausted ${retries} retries for ${url}`);
}

// ── Ticker → CIK mapping ────────────────────────────────────────────

interface CompanyTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

let tickerMap: Map<string, CompanyTickerEntry> | null = null;

export async function getTickerCikMap(): Promise<Map<string, CompanyTickerEntry>> {
  if (tickerMap) return tickerMap;

  logger.info('[EdgarClient] Fetching company_tickers.json...');
  const res = await rateLimitedFetch(`${SEC_BASE}/files/company_tickers.json`);
  const data = (await res.json()) as Record<string, CompanyTickerEntry>;

  tickerMap = new Map();
  for (const entry of Object.values(data)) {
    tickerMap.set(entry.ticker.toUpperCase(), entry);
  }

  logger.info(`[EdgarClient] Loaded ${tickerMap.size} ticker→CIK mappings`);
  return tickerMap;
}

export function cikTo10Digits(cik: number | string): string {
  return String(cik).padStart(10, '0');
}

// ── Submissions (filing history) ────────────────────────────────────

export interface SubmissionEntry {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  form: string;
  primaryDocument: string;
}

export interface SubmissionsResponse {
  name: string;
  cik: string;
  tickers: string[];
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
    };
  };
}

export async function getSubmissions(cik10: string): Promise<SubmissionsResponse> {
  logger.debug(`[EdgarClient] Fetching submissions for CIK ${cik10}...`);
  const res = await rateLimitedFetch(`${SEC_DATA}/submissions/CIK${cik10}.json`);
  return (await res.json()) as SubmissionsResponse;
}

// ── Filing document HTML ────────────────────────────────────────────

interface FilingDirectoryItem {
  name: string;
  href?: string;
  size?: number | string;
  last_modified?: string;
  type?: string;
}

interface FilingDirectoryIndexResponse {
  directory: {
    name: string;
    item: FilingDirectoryItem[];
  };
}

export interface FilingArchiveUrls {
  filingDirectoryUrl: string;
  filingDirectoryIndexJsonUrl: string;
  filingDirectoryIndexXmlUrl: string;
  filingDirectoryIndexHtmlUrl: string;
  filingIndexHtmlUrl: string;
  filingIndexHtmUrl: string;
  filingTextUrl: string;
  primaryDocumentUrl?: string;
  inlineViewerUrl?: string;
}

export function buildFilingArchiveUrls(
  cik: number | string,
  accessionNumber: string,
  primaryDocument?: string,
): FilingArchiveUrls {
  const cikNumeric = String(Number(cik));
  const accessionDashed = accessionNumber;
  const accessionCompact = accessionDashed.replace(/-/g, '');
  const filingDirectoryUrl = `${SEC_BASE}/Archives/edgar/data/${cikNumeric}/${accessionCompact}`;
  const primaryDocumentUrl = primaryDocument
    ? `${filingDirectoryUrl}/${primaryDocument}`
    : undefined;

  return {
    filingDirectoryUrl,
    filingDirectoryIndexJsonUrl: `${filingDirectoryUrl}/index.json`,
    filingDirectoryIndexXmlUrl: `${filingDirectoryUrl}/index.xml`,
    filingDirectoryIndexHtmlUrl: `${filingDirectoryUrl}/index.html`,
    filingIndexHtmlUrl: `${filingDirectoryUrl}/${accessionDashed}-index.html`,
    filingIndexHtmUrl: `${filingDirectoryUrl}/${accessionDashed}-index.htm`,
    filingTextUrl: `${SEC_BASE}/Archives/edgar/data/${cikNumeric}/${accessionDashed}.txt`,
    primaryDocumentUrl,
    inlineViewerUrl: primaryDocumentUrl
      ? `${SEC_BASE}/ix?doc=${primaryDocumentUrl.replace(SEC_BASE, '')}`
      : undefined,
  };
}

async function fetchFilingDirectoryIndex(
  cik: number | string,
  accessionNumber: string,
): Promise<FilingDirectoryIndexResponse> {
  const { filingDirectoryIndexJsonUrl } = buildFilingArchiveUrls(cik, accessionNumber);
  const res = await rateLimitedFetch(filingDirectoryIndexJsonUrl);
  return (await res.json()) as FilingDirectoryIndexResponse;
}

export async function fetchFilingHtml(
  cik: number,
  accessionNumber: string,
  primaryDocument?: string,
): Promise<string> {
  const archiveUrls = buildFilingArchiveUrls(cik, accessionNumber, primaryDocument);

  if (archiveUrls.primaryDocumentUrl) {
    return await rateLimitedFetch(archiveUrls.primaryDocumentUrl, 'text/html').then((r) =>
      r.text(),
    );
  }

  const directoryIndex = await fetchFilingDirectoryIndex(cik, accessionNumber);
  const items = directoryIndex.directory?.item ?? [];
  const candidate = items.find(
    (item) => /\.(htm|html)$/i.test(item.name) && !/index/i.test(item.name),
  );

  if (!candidate) {
    const { filingDirectoryIndexJsonUrl } = archiveUrls;
    throw new Error(
      `Could not find primary HTML document in filing directory index: ${filingDirectoryIndexJsonUrl}`,
    );
  }

  const { filingDirectoryUrl } = archiveUrls;
  const docUrl = `${filingDirectoryUrl}/${candidate.name}`;
  return await rateLimitedFetch(docUrl, 'text/html').then((r) => r.text());
}

// ── XBRL Company Facts ──────────────────────────────────────────────

export interface XbrlFactEntry {
  start: string;
  end: string;
  val: number;
  accn: string;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  frame?: string;
}

export interface XbrlCompanyFacts {
  cik: string;
  entityName: string;
  facts: Record<
    string,
    Record<
      string,
      {
        label: string;
        description: string;
        units: Record<string, XbrlFactEntry[]>;
      }
    >
  >;
}

export async function getCompanyFacts(cik10: string): Promise<XbrlCompanyFacts> {
  const res = await rateLimitedFetch(`${SEC_DATA}/api/xbrl/companyfacts/CIK${cik10}.json`);
  return (await res.json()) as XbrlCompanyFacts;
}
