import { XbrlCompanyFacts, XbrlFactEntry } from './edgar-client';
import { logger } from '@krobert/utils';

export interface XbrlMetrics {
  ticker: string;
  fiscalYear: number;
  fiscalPeriod: string;
  facts: Record<
    string,
    { value: number; unit: string; endDate: string; filed: string; derived?: boolean }
  >;
}

// Short key → [us-gaap concept name, ifrs-full concept name]
const KEY_CONCEPTS: Record<string, [string | null, string | null]> = {
  revenue: ['Revenues', 'Revenue'],
  revenueFromContract: ['RevenueFromContractWithCustomerExcludingAssessedTax', null],
  costOfRevenue: ['CostOfRevenue', 'CostOfSales'],
  costOfGoodsAndServices: ['CostOfGoodsAndServicesSold', null],
  grossProfit: ['GrossProfit', 'GrossProfit'],
  operatingIncome: ['OperatingIncomeLoss', 'OperatingProfitLoss'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  epsBasic: ['EarningsPerShareBasic', 'BasicEarningsLossPerShare'],
  epsDiluted: ['EarningsPerShareDiluted', 'DilutedEarningsLossPerShare'],
  totalAssets: ['Assets', 'Assets'],
  totalLiabilities: ['Liabilities', 'Liabilities'],
  currentAssets: ['AssetsCurrent', 'CurrentAssets'],
  currentLiabilities: ['LiabilitiesCurrent', 'CurrentLiabilities'],
  stockholdersEquity: ['StockholdersEquity', 'Equity'],
  operatingCashFlow: [
    'NetCashProvidedByUsedInOperatingActivities',
    'CashFlowsFromUsedInOperatingActivities',
  ],
  capex: [
    'PaymentsToAcquirePropertyPlantAndEquipment',
    'PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities',
  ],
  freeCashFlow: [null, null],
  longTermDebt: ['LongTermDebtNoncurrent', 'NoncurrentLiabilities'],
  rAndD: ['ResearchAndDevelopmentExpense', 'ResearchAndDevelopmentExpense'],
  sGAndA: ['SellingGeneralAndAdministrativeExpense', 'SellingGeneralAndAdministrativeExpense'],
  revenueBySegment: [
    'RevenueFromExternalCustomersAttributedToReportableSegmentsByGeographicAreas',
    null,
  ],
};

const FORM_TYPES_ANNUAL = new Set(['10-K', '10-K/A', '10-KT', '20-F', '20-F/A', '40-F', '40-F/A']);

// Preferred units in order — USD first, then other common currencies
const PREFERRED_UNITS = ['USD', 'EUR', 'CAD', 'GBP', 'JPY', 'CHF', 'AUD', 'CNY'];

// The shape of a single XBRL concept as stored in the company facts JSON.
type XbrlConcept = {
  label: string;
  description: string;
  units: Record<string, XbrlFactEntry[]>;
};

function pickUnit(concept: XbrlConcept): string | null {
  for (const u of PREFERRED_UNITS) {
    if (concept.units[u]) return u;
  }
  for (const u of Object.keys(concept.units)) {
    const first = concept.units[u]?.[0];
    if (first && !isNaN(Number(first.val))) return u;
  }
  const keys = Object.keys(concept.units);
  return keys.length > 0 ? keys[0] : null;
}

function pickBestValue(entries: XbrlFactEntry[]): XbrlFactEntry | null {
  if (entries.length === 0) return null;

  const withFrame = entries.filter((e) => e.frame);
  const pool = withFrame.length > 0 ? withFrame : entries;
  return pool.sort((a, b) => new Date(b.filed).getTime() - new Date(a.filed).getTime())[0];
}

// ── Extraction core (shared between attempts) ────────────────────────

type ExtractedYear = Record<
  string,
  { value: number; unit: string; endDate: string; filed: string; derived?: boolean }
>;

function tryExtractFromNamespace(
  concepts: Record<string, XbrlConcept>,
  namespace: string,
  ticker: string,
): { byFiscalYear: Map<number, ExtractedYear>; hitConcepts: string[]; missConcepts: string[] } {
  const nsIndex = namespace === 'us-gaap' ? 0 : 1;
  const byFiscalYear = new Map<number, ExtractedYear>();
  const hitConcepts: string[] = [];
  const missConcepts: string[] = [];

  for (const [shortKey, [usConcept, ifrsConcept]] of Object.entries(KEY_CONCEPTS)) {
    const conceptName = nsIndex === 0 ? usConcept : ifrsConcept;
    if (!conceptName) continue;
    const concept = concepts[conceptName];
    if (!concept?.units) {
      missConcepts.push(shortKey);
      continue;
    }

    const unitKey = pickUnit(concept);
    if (!unitKey) {
      missConcepts.push(shortKey);
      continue;
    }
    const entries = concept.units[unitKey];
    if (!entries) {
      missConcepts.push(shortKey);
      continue;
    }

    const annualEntries = entries
      .filter((e) => e.fp === 'FY' && FORM_TYPES_ANNUAL.has(e.form))
      .sort((a, b) => (b.fy ?? 0) - (a.fy ?? 0));

    if (annualEntries.length === 0) {
      missConcepts.push(shortKey);
      continue;
    }

    hitConcepts.push(shortKey);

    const seenFy = new Set<number>();
    for (const entry of annualEntries) {
      if (entry.fy == null || seenFy.has(entry.fy)) continue;
      const best = pickBestValue(annualEntries.filter((e) => e.fy === entry.fy));
      if (!best || seenFy.has(entry.fy)) continue;
      seenFy.add(entry.fy);

      if (!byFiscalYear.has(entry.fy)) byFiscalYear.set(entry.fy, {});
      byFiscalYear.get(entry.fy)![shortKey] = {
        value: best.val,
        unit: unitKey,
        endDate: best.end,
        filed: best.filed,
      };
    }
  }

  return { byFiscalYear, hitConcepts, missConcepts };
}

// ── Main entry point ─────────────────────────────────────────────────

export function extractKeyMetrics(
  ticker: string,
  factsData: XbrlCompanyFacts,
  maxYears = 3,
): XbrlMetrics[] {
  const availableNamespaces = Object.keys(factsData.facts ?? {});

  // Build candidate list: known namespaces first, then any non-dei fallback.
  const candidates = [
    ...['us-gaap', 'ifrs-full'].filter((ns) => factsData.facts?.[ns]),
    ...availableNamespaces.filter((ns) => ns !== 'dei' && ns !== 'us-gaap' && ns !== 'ifrs-full'),
  ];

  if (candidates.length === 0) {
    logger.warn(
      `[XBRL] No financial namespace found for ${ticker}. Available: ${availableNamespaces.join(', ') || '(none)'}`,
    );
    return [];
  }

  // Try each namespace; pick the one yielding the most fiscal years.
  let best: { metrics: XbrlMetrics[]; namespace: string } | null = null;

  for (const namespace of candidates) {
    const concepts = factsData.facts[namespace];
    logger.debug(
      `[XBRL] Trying "${namespace}" for ${ticker} (${Object.keys(concepts).length} concepts)`,
    );

    const { byFiscalYear, hitConcepts, missConcepts } = tryExtractFromNamespace(
      concepts,
      namespace,
      ticker,
    );

    logger.debug(
      `[XBRL] ${ticker} @ "${namespace}": hit=${hitConcepts.join(',') || '(none)'}, miss=${missConcepts.join(',') || '(none)'}`,
    );

    if (byFiscalYear.size === 0) continue;

    // Compute derived metrics
    for (const [, facts] of byFiscalYear) {
      if (facts.operatingCashFlow && facts.capex) {
        facts.freeCashFlow = {
          value: facts.operatingCashFlow.value - Math.abs(facts.capex.value),
          unit: facts.operatingCashFlow.unit,
          endDate: facts.operatingCashFlow.endDate,
          filed: facts.operatingCashFlow.filed,
          derived: true,
        };
      }
      if (!facts.revenue && facts.revenueFromContract) {
        facts.revenue = { ...facts.revenueFromContract };
      }
      if (!facts.costOfRevenue && facts.costOfGoodsAndServices) {
        facts.costOfRevenue = { ...facts.costOfGoodsAndServices };
      }
    }

    const sortedYears = [...byFiscalYear.keys()].sort((a, b) => b - a);
    const metrics = sortedYears.slice(0, maxYears).map((fy) => ({
      ticker,
      fiscalYear: fy,
      fiscalPeriod: 'FY',
      facts: byFiscalYear.get(fy)!,
    }));

    if (!best || metrics.length > best.metrics.length) {
      best = { metrics, namespace };
    }
  }

  if (!best) {
    logger.warn(`[XBRL] No annual (FY) metrics for ${ticker} in any of: ${candidates.join(', ')}`);
    return [];
  }

  logger.info(
    `[XBRL] ${ticker}: ${best.metrics.length} FY from "${best.namespace}" (${candidates.length} ns tried)`,
  );
  return best.metrics;
}
