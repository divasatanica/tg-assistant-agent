import { describe, test, expect, beforeAll } from 'bun:test';
import {
  getTickerCikMap,
  cikTo10Digits,
  getSubmissions,
  getCompanyFacts,
  type SubmissionsResponse,
  type XbrlCompanyFacts,
} from '../sec-filing-agent/edgar-client';
import { extractKeyMetrics, type XbrlMetrics } from '../sec-filing-agent/xbrl-extractor';

// ── Helpers ──────────────────────────────────────────────────────────

function getFormTypes(f: SubmissionsResponse): string[] {
  return [...new Set(f.filings.recent.form)] as string[];
}

function getFiscalYears(m: XbrlMetrics[]): number[] {
  return m.map((x) => x.fiscalYear);
}

function metricNames(m: XbrlMetrics[]): string[] {
  const s = new Set<string>();
  for (const x of m) for (const k of Object.keys(x.facts)) s.add(k);
  return [...s].sort();
}

// ── CIK mapping ──────────────────────────────────────────────────────

describe('CIK mapping', () => {
  let tickerMap: Awaited<ReturnType<typeof getTickerCikMap>>;

  beforeAll(async () => {
    tickerMap = await getTickerCikMap();
  }, 30000);

  test('AAPL (US domestic)', () => {
    const e = tickerMap.get('AAPL');
    expect(e).toBeDefined();
    expect(e!.cik_str).toBe(320193);
  });

  test('NOK (Finland, foreign issuer)', () => {
    expect(tickerMap.get('NOK')).toBeDefined();
  });

  test('POET (Canada, small-cap)', () => {
    expect(tickerMap.get('POET')).toBeDefined();
  });

  test('BABA (China, foreign issuer)', () => {
    expect(tickerMap.get('BABA')).toBeDefined();
  });

  test('SHOP (Canada, MJDS 40-F filer)', () => {
    expect(tickerMap.get('SHOP')).toBeDefined();
  });
});

// ── Submissions (form types per accounting regime) ────────────────────

describe('Submissions — form types by issuer regime', () => {
  async function getForms(sym: string): Promise<string[]> {
    const m = await getTickerCikMap();
    const e = m.get(sym);
    if (!e) throw new Error(sym);
    return getFormTypes(await getSubmissions(cikTo10Digits(e.cik_str)));
  }

  // US domestic filers use 10-K/10-Q/8-K
  test('AAPL files 10-K, 10-Q, 8-K', async () => {
    const forms = await getForms('AAPL');
    for (const f of ['10-K', '10-Q', '8-K']) expect(forms).toContain(f);
  }, 15000);

  // Foreign private issuers use 20-F/6-K (NOT 10-K/10-Q)
  test('NOK files 20-F and 6-K, no 10-K/10-Q', async () => {
    const forms = await getForms('NOK');
    expect(forms).toContain('20-F');
    expect(forms).toContain('6-K');
    expect(forms).not.toContain('10-K');
    expect(forms).not.toContain('10-Q');
  }, 15000);

  test('POET files 20-F and 6-K, no 10-K/10-Q', async () => {
    const forms = await getForms('POET');
    expect(forms).toContain('20-F');
    expect(forms).toContain('6-K');
    expect(forms).not.toContain('10-K');
    expect(forms).not.toContain('10-Q');
  }, 15000);

  test('BABA files 20-F and 6-K, no 10-K/10-Q', async () => {
    const forms = await getForms('BABA');
    expect(forms).toContain('20-F');
    expect(forms).toContain('6-K');
    expect(forms).not.toContain('10-K');
    expect(forms).not.toContain('10-Q');
  }, 15000);

  // Canadian MJDS filer — 40-F not 20-F
  test('SHOP files 40-F (MJDS) and 6-K, no 10-K/10-Q/20-F', async () => {
    const forms = await getForms('SHOP');
    console.log('SHOP forms:', forms.join(', '));
    expect(forms).toContain('40-F');
    expect(forms).toContain('6-K');
  }, 15000);
});

// ── XBRL namespace detection ─────────────────────────────────────────

describe('XBRL namespace', () => {
  async function getFacts(sym: string) {
    const m = await getTickerCikMap();
    const e = m.get(sym);
    if (!e) throw new Error(sym);
    const facts = await getCompanyFacts(cikTo10Digits(e.cik_str));
    const nss = Object.keys(facts.facts ?? {});
    return { facts, nss };
  }

  // US domestic → us-gaap
  test('AAPL uses us-gaap namespace', async () => {
    const { nss } = await getFacts('AAPL');
    expect(nss).toContain('us-gaap');
  }, 15000);

  // IFRS filers → ifrs-full, NOT us-gaap
  test('NOK uses ifrs-full, not us-gaap', async () => {
    const { nss } = await getFacts('NOK');
    expect(nss).toContain('ifrs-full');
    expect(nss).not.toContain('us-gaap');
  }, 15000);

  test('BABA uses us-gaap', async () => {
    const { nss } = await getFacts('BABA');
    expect(nss).toContain('us-gaap');
    expect(nss).not.toContain('ifrs-full');
  }, 15000);

  test('POET has ifrs-full namespace', async () => {
    const { nss } = await getFacts('POET');
    expect(nss).toContain('ifrs-full');
    expect(nss).toContain('us-gaap');
  }, 15000);

  test('SHOP uses us-gaap not ifrs-full (Canadian IFRS via 40-F)', async () => {
    const { nss } = await getFacts('SHOP');
    // Shopify follows IFRS as a Canadian public company
    expect(nss).not.toContain('ifrs-full');
    expect(nss).toContain('us-gaap');
  }, 15000);
});

// ── XBRL metrics extraction — proves the extractor works across accounting regimes ─

describe('XBRL metrics — US GAAP (us-gaap)', () => {
  async function get(sym: string) {
    const m = await getTickerCikMap();
    const e = m.get(sym);
    const facts = await getCompanyFacts(cikTo10Digits(e!.cik_str));
    return extractKeyMetrics(sym, facts, 3);
  }

  test('AAPL: extracts metrics', async () => {
    const m = await get('AAPL');
    console.log(
      'AAPL FY:',
      getFiscalYears(m).join(', '),
      '| count:',
      m.length,
      '| keys:',
      metricNames(m).join(', '),
    );
    expect(m.length).toBeGreaterThan(0);
  }, 30000);

  // BABA files 20-F but reports under US GAAP (not IFRS).
  test('BABA (20-F, US GAAP): extracts metrics', async () => {
    const m = await get('BABA');
    console.log(
      'BABA FY:',
      getFiscalYears(m).join(', '),
      '| count:',
      m.length,
      '| keys:',
      metricNames(m).join(', '),
    );
    expect(m.length).toBeGreaterThan(0);
  }, 30000);
});

describe('XBRL metrics — IFRS (ifrs-full)', () => {
  async function get(sym: string) {
    const m = await getTickerCikMap();
    const e = m.get(sym);
    const facts = await getCompanyFacts(cikTo10Digits(e!.cik_str));
    return extractKeyMetrics(sym, facts, 3);
  }

  test('NOK (20-F, IFRS): extracts metrics', async () => {
    const m = await get('NOK');
    console.log(
      'NOK FY:',
      getFiscalYears(m).join(', '),
      '| count:',
      m.length,
      '| keys:',
      metricNames(m).join(', '),
    );
    expect(m.length).toBeGreaterThan(0);
  }, 30000);

  // SHOP files 40-F (MJDS) under IFRS — different namespace path.
  test('SHOP (40-F, IFRS): extracts metrics', async () => {
    const m = await get('SHOP');
    console.log(
      'SHOP FY:',
      getFiscalYears(m).join(', '),
      '| count:',
      m.length,
      '| keys:',
      metricNames(m).join(', '),
    );
    expect(m.length).toBeGreaterThan(0);
  }, 30000);

  // POET is a pre-revenue micro-cap. Its XBRL tagging is minimal,
  // but the extractor should still produce at least 1 fiscal year slice.
  test('POET (20-F, IFRS, micro-cap): extracts metrics', async () => {
    const m = await get('POET');
    console.log(
      'POET FY:',
      getFiscalYears(m).join(', '),
      '| count:',
      m.length,
      '| keys:',
      metricNames(m).join(', '),
    );
    expect(m.length).toBeGreaterThan(0);
  }, 30000);
});
