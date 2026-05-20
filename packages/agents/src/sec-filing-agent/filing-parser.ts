export interface ParsedSection {
  label: string;
  text: string;
}

const ITEM_PATTERNS_10K: Record<string, { pattern: RegExp; label: string }> = {
  item1: {
    pattern: /(?:Item|ITEM)\s*&?nbsp;?\s*1\s*[.—\s-]\s*(?:Business|BUSINESS)/,
    label: 'Item 1 - Business',
  },
  item1a: {
    pattern: /(?:Item|ITEM)\s*&?nbsp;?\s*1\s*A\s*[.—\s-]/,
    label: 'Item 1A - Risk Factors',
  },
  item7: {
    pattern: /(?:Item|ITEM)\s*&?nbsp;?\s*7\s*[.—\s-]\s*(?:Management|MANAGEMENT)/,
    label: 'Item 7 - MD&A',
  },
  item7a: {
    pattern: /(?:Item|ITEM)\s*&?nbsp;?\s*7\s*A\s*[.—\s-]/,
    label: 'Item 7A - Market Risk',
  },
  item8: {
    pattern: /(?:Item|ITEM)\s*&?nbsp;?\s*8\s*[.—\s-]\s*(?:Financial|FINANCIAL)/,
    label: 'Item 8 - Financial Statements',
  },
};

const ITEM_PATTERNS_8K: Record<string, { pattern: RegExp; label: string }> = {
  item101: {
    pattern: /(?:Item|ITEM|Section|SECTION)\s*&?nbsp;?\s*1\.01/,
    label: 'Item 1.01 - Entry into Material Definitive Agreement',
  },
  item102: {
    pattern: /(?:Item|ITEM|Section|SECTION)\s*&?nbsp;?\s*1\.02/,
    label: 'Item 1.02 - Termination of Material Definitive Agreement',
  },
  item103: {
    pattern: /(?:Item|ITEM|Section|SECTION)\s*&?nbsp;?\s*1\.03/,
    label: 'Item 1.03 - Bankruptcy or Receivership',
  },
  item201: {
    pattern: /(?:Item|ITEM|Section|SECTION)\s*&?nbsp;?\s*2\.01/,
    label: 'Item 2.01 - Completion of Acquisition or Disposition',
  },
  item202: {
    pattern: /(?:Item|ITEM|Section|SECTION)\s*&?nbsp;?\s*2\.02/,
    label: 'Item 2.02 - Results of Operations (Earnings Release)',
  },
  item203: {
    pattern: /(?:Item|ITEM|Section|SECTION)\s*&?nbsp;?\s*2\.03/,
    label: 'Item 2.03 - Direct Financial Obligation',
  },
  item501: {
    pattern: /(?:Item|ITEM|Section|SECTION)\s*&?nbsp;?\s*5\.01/,
    label: 'Item 5.01 - Changes in Control',
  },
  item502: {
    pattern: /(?:Item|ITEM|Section|SECTION)\s*&?nbsp;?\s*5\.02/,
    label: 'Item 5.02 - Departure/Certain Officers',
  },
  item503: {
    pattern: /(?:Item|ITEM|Section|SECTION)\s*&?nbsp;?\s*5\.03/,
    label: 'Item 5.03 - Amendments to Articles',
  },
  item701: {
    pattern: /(?:Item|ITEM|Section|SECTION)\s*&?nbsp;?\s*7\.01/,
    label: 'Item 7.01 - Regulation FD Disclosure',
  },
  item901: {
    pattern: /(?:Item|ITEM|Section|SECTION)\s*&?nbsp;?\s*9\.01/,
    label: 'Item 9.01 - Financial Statements and Exhibits',
  },
};

const ITEM_PATTERNS_DEF14A: Record<string, { pattern: RegExp; label: string }> = {
  proxyBackground: {
    pattern: /(?:Background|BACKGROUND|General|GENERAL|Introduction|INTRODUCTION)/,
    label: 'Proxy - Background/Introduction',
  },
  proposal1: {
    pattern: /(?:Proposal|PROPOSAL)\s*&?nbsp;?\s*(?:1|No\.\s*1|One|ONE)[:\s]/,
    label: 'Proxy - Proposal 1 (Election of Directors)',
  },
  compensationDiscussion: {
    pattern: /(?:Compensation|COMPENSATION)\s*&?nbsp;?\s*(?:Discussion|DISCUSSION)/,
    label: 'Proxy - Compensation Discussion & Analysis',
  },
  executiveCompensation: {
    pattern: /(?:Executive|EXECUTIVE)\s*&?nbsp;?\s*(?:Compensation|COMPENSATION)/,
    label: 'Proxy - Executive Compensation Tables',
  },
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSectionsByPatterns(
  html: string,
  patterns: Record<string, { pattern: RegExp; label: string }>,
  targetKeys: string[],
  maxCharsPerSection = 15000,
): ParsedSection[] {
  const plainText = stripHtml(html);

  const matches: Array<{ key: string; label: string; position: number }> = [];
  for (const key of targetKeys) {
    const entry = patterns[key];
    if (!entry) continue;
    const match = entry.pattern.exec(plainText);
    if (match) {
      matches.push({ key, label: entry.label, position: match.index });
    }
  }
  matches.sort((a, b) => a.position - b.position);

  const sections: ParsedSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const startPlain = matches[i].position;
    const endPlain = i < matches.length - 1 ? matches[i + 1].position : plainText.length;

    let sectionText = plainText.slice(startPlain, endPlain).trim();
    if (sectionText.length > maxCharsPerSection) {
      sectionText = sectionText.slice(0, maxCharsPerSection) + '\n\n[...truncated for length...]';
    }

    sections.push({ label: matches[i].label, text: sectionText });
  }

  return sections;
}

export function parseFilingHtml(html: string, formType: string): ParsedSection[] {
  const normalizedForm = formType.toUpperCase();

  switch (normalizedForm) {
    case '10-K':
    case '10-K/A':
    case '10-KT':
      return extractSectionsByPatterns(html, ITEM_PATTERNS_10K, [
        'item1',
        'item1a',
        'item7',
        'item7a',
        'item8',
      ]);

    case '10-Q':
    case '10-Q/A':
      return extractSectionsByPatterns(html, ITEM_PATTERNS_10K, ['item1', 'item7', 'item8']);

    case '8-K':
    case '8-K/A':
      return extractSectionsByPatterns(html, ITEM_PATTERNS_8K, [
        'item101',
        'item102',
        'item103',
        'item201',
        'item202',
        'item203',
        'item501',
        'item502',
        'item503',
        'item701',
        'item901',
      ]);

    case 'DEF 14A':
    case 'DEFR14A':
    case 'DEFA14A':
      return extractSectionsByPatterns(html, ITEM_PATTERNS_DEF14A, [
        'proxyBackground',
        'proposal1',
        'compensationDiscussion',
        'executiveCompensation',
      ]);

    default:
      // Generic fallback: try 10-K patterns since most filings follow similar structure
      return extractSectionsByPatterns(html, ITEM_PATTERNS_10K, ['item1', 'item7', 'item8']);
  }
}
