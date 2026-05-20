import { XbrlCompanyFacts, XbrlFactEntry } from './edgar-client';

export interface XbrlMetrics {
  ticker: string;
  fiscalYear: number;
  fiscalPeriod: string;
  facts: Record<
    string,
    { value: number; unit: string; endDate: string; filed: string; derived?: boolean }
  >;
}

const KEY_CONCEPTS: Record<string, string | null> = {
  revenue: 'Revenues',
  revenueFromContract: 'RevenueFromContractWithCustomerExcludingAssessedTax',
  costOfRevenue: 'CostOfRevenue',
  costOfGoodsAndServices: 'CostOfGoodsAndServicesSold',
  grossProfit: 'GrossProfit',
  operatingIncome: 'OperatingIncomeLoss',
  netIncome: 'NetIncomeLoss',
  epsBasic: 'EarningsPerShareBasic',
  epsDiluted: 'EarningsPerShareDiluted',
  totalAssets: 'Assets',
  totalLiabilities: 'Liabilities',
  currentAssets: 'AssetsCurrent',
  currentLiabilities: 'LiabilitiesCurrent',
  stockholdersEquity: 'StockholdersEquity',
  operatingCashFlow: 'NetCashProvidedByUsedInOperatingActivities',
  capex: 'PaymentsToAcquirePropertyPlantAndEquipment',
  freeCashFlow: null,
  longTermDebt: 'LongTermDebtNoncurrent',
  rAndD: 'ResearchAndDevelopmentExpense',
  sGAndA: 'SellingGeneralAndAdministrativeExpense',
  revenueBySegment: 'RevenueFromExternalCustomersAttributedToReportableSegmentsByGeographicAreas',
};

function pickBestValue(entries: XbrlFactEntry[]): XbrlFactEntry | null {
  if (entries.length === 0) return null;

  // Prefer entries with a frame (most precisely scoped to the period)
  const withFrame = entries.filter((e) => e.frame);
  const pool = withFrame.length > 0 ? withFrame : entries;

  // Take the most recently filed for this fiscal period
  return pool.sort((a, b) => new Date(b.filed).getTime() - new Date(a.filed).getTime())[0];
}

export function extractKeyMetrics(
  ticker: string,
  factsData: XbrlCompanyFacts,
  maxYears = 3,
): XbrlMetrics[] {
  const usGaap = factsData.facts?.['us-gaap'];
  if (!usGaap) return [];

  const byFiscalYear: Map<
    number,
    Record<
      string,
      { value: number; unit: string; endDate: string; filed: string; derived?: boolean }
    >
  > = new Map();

  for (const [shortKey, conceptName] of Object.entries(KEY_CONCEPTS)) {
    if (!conceptName) continue;
    const concept = usGaap[conceptName];
    if (!concept?.units) continue;

    const unitKey = concept.units['USD'] ? 'USD' : Object.keys(concept.units)[0];
    const entries = concept.units[unitKey];
    if (!entries) continue;

    const annualEntries = entries
      .filter((e) => e.fp === 'FY' && (e.form === '10-K' || e.form === '10-K/A'))
      .sort((a, b) => (b.fy ?? 0) - (a.fy ?? 0));

    const seenFy = new Set<number>();
    for (const entry of annualEntries) {
      if (entry.fy == null || seenFy.has(entry.fy)) continue;
      const best = pickBestValue(annualEntries.filter((e) => e.fy === entry.fy));
      if (!best || seenFy.has(entry.fy)) continue;
      seenFy.add(entry.fy);

      if (!byFiscalYear.has(entry.fy)) {
        byFiscalYear.set(entry.fy, {});
      }
      byFiscalYear.get(entry.fy)![shortKey] = {
        value: best.val,
        unit: unitKey,
        endDate: best.end,
        filed: best.filed,
      };
    }
  }

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
    // Revenue fallback: if 'Revenues' not found, try the contract-based revenue
    if (!facts.revenue && facts.revenueFromContract) {
      facts.revenue = { ...facts.revenueFromContract };
    }
    // Cost of revenue fallback
    if (!facts.costOfRevenue && facts.costOfGoodsAndServices) {
      facts.costOfRevenue = { ...facts.costOfGoodsAndServices };
    }
  }

  const sortedYears = [...byFiscalYear.keys()].sort((a, b) => b - a);
  return sortedYears.slice(0, maxYears).map((fy) => ({
    ticker,
    fiscalYear: fy,
    fiscalPeriod: 'FY',
    facts: byFiscalYear.get(fy)!,
  }));
}
