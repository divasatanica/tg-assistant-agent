import { logger, SEC_USER_AGENT } from '@krobert/utils';

const SEC_BASE = 'https://www.sec.gov';
const SEC_DATA = 'https://data.sec.gov';

let lastRequestTime = 0;

async function rateLimitedFetch(url: string, accept = 'application/json'): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 200) {
    await new Promise((r) => setTimeout(r, 200 - elapsed));
  }
  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: {
      'User-Agent': SEC_USER_AGENT,
      Accept: accept,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '[unreadable]');
    throw new Error(`SEC API ${response.status} for ${url}: ${body.slice(0, 300)}`);
  }

  return response;
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
  const res = await rateLimitedFetch(`${SEC_DATA}/submissions/CIK${cik10}.json`);
  return (await res.json()) as SubmissionsResponse;
}

// ── Filing document HTML ────────────────────────────────────────────

export async function fetchFilingHtml(cik: number, accessionNumber: string): Promise<string> {
  const accNoHyphenless = accessionNumber.replace(/-/g, '');

  // First, fetch the index page to find the actual document URL
  const indexUrl = `${SEC_BASE}/Archives/edgar/data/${cik}/${accNoHyphenless}/${accNoHyphenless}-index.htm`;
  const indexHtml = await rateLimitedFetch(indexUrl, 'text/html').then((r) => r.text());

  // Extract the primary document href from the index page
  const docMatch = indexHtml.match(/href="([^"]+\.(?:htm|html))"/i);
  if (!docMatch) {
    throw new Error(`Could not find document link in filing index: ${indexUrl}`);
  }

  const docPath = docMatch[1];
  const docUrl = `${SEC_BASE}/Archives/edgar/data/${cik}/${accNoHyphenless}/${docPath}`;
  const docHtml = await rateLimitedFetch(docUrl, 'text/html').then((r) => r.text());

  return docHtml;
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
    string, // namespace: "us-gaap", "dei", etc.
    Record<
      string, // concept name: "Assets", "Revenues", etc.
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
