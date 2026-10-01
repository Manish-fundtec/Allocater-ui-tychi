export type PlLeafRow = {
  accountCode: string;
  accountName: string;
  category: string;
  mtdAmount: number;
};

export type FundPlBuckets = {
  realizedPnl: number;
  unrealizedPnl: number;
  onboardingFee: number;
  brokerageExpense: number;
  kycAmlFee: number;
  bankFees: number;
  administrationFee: number;
  professionalFees: number;
  interestIncome: number;
  interestExpense: number;
  organizationalExpenses: number;
  dividendIncome: number;
};

const EMPTY_BUCKETS: FundPlBuckets = {
  realizedPnl: 0,
  unrealizedPnl: 0,
  onboardingFee: 0,
  brokerageExpense: 0,
  kycAmlFee: 0,
  bankFees: 0,
  administrationFee: 0,
  professionalFees: 0,
  interestIncome: 0,
  interestExpense: 0,
  organizationalExpenses: 0,
  dividendIncome: 0,
};

function rowAccountCode(row: Record<string, unknown>): string {
  return String(
    row.account_code ?? row.accountCode ?? row.gl_code ?? row.glCode ?? "",
  ).trim();
}

function rowAccountName(row: Record<string, unknown>): string {
  return String(
    row.account_name ??
      row.accountName ??
      row.gl_name ??
      row.glName ??
      row.description ??
      row.label ??
      "",
  ).trim();
}

function rowCategory(row: Record<string, unknown>): string {
  return String(row.category ?? row.account_type ?? "").trim();
}

function rowMtd(row: Record<string, unknown>): number {
  const keys = ["mtd_amount", "mtd", "MTD", "month_to_date", "amount", "value"];
  for (const key of keys) {
    const v = row[key];
    if (v != null && v !== "") return Number(v);
  }
  return 0;
}

function collectCandidateRows(raw: unknown): Record<string, unknown>[] {
  if (!raw || typeof raw !== "object") return [];
  const root = raw as Record<string, unknown>;
  const candidates: unknown[] = [];
  if (Array.isArray(root.rows)) candidates.push(...root.rows);
  if (Array.isArray(root.line_items)) candidates.push(...root.line_items);
  if (Array.isArray(root.expenses)) candidates.push(...root.expenses);
  if (Array.isArray(root.income)) candidates.push(...root.income);
  if (Array.isArray(root.sections)) {
    for (const section of root.sections) {
      if (section && typeof section === "object") {
        const s = section as Record<string, unknown>;
        if (Array.isArray(s.rows)) candidates.push(...s.rows);
        if (Array.isArray(s.line_items)) candidates.push(...s.line_items);
      }
    }
  }
  return candidates.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object",
  );
}

export function parsePlLeafRows(raw: unknown): PlLeafRow[] {
  return collectCandidateRows(raw)
    .map((row) => ({
      accountCode: rowAccountCode(row),
      accountName: rowAccountName(row),
      category: rowCategory(row),
      mtdAmount: rowMtd(row),
    }))
    .filter((row) => row.mtdAmount !== 0 || row.accountName || row.accountCode);
}

function isMgmtOrPerfFee(code: string, name: string): boolean {
  const n = name.toLowerCase();
  return (
    code === "51000" ||
    code === "52000" ||
    n.includes("management fee") ||
    n.includes("performance fee")
  );
}

type BucketKey = keyof FundPlBuckets;

function classifyBucket(code: string, name: string): BucketKey {
  const n = name.toLowerCase();
  if (n.includes("unrealized")) return "unrealizedPnl";
  if (n.includes("dividend")) return "dividendIncome";
  if (n.includes("realized")) return "realizedPnl";
  if (n.includes("onboarding")) return "onboardingFee";
  if (n.includes("brokerage")) return "brokerageExpense";
  if (n.includes("kyc") || n.includes("aml")) return "kycAmlFee";
  if (n.includes("bank fee")) return "bankFees";
  if (n.includes("administration") || n.includes("admin fee")) {
    return "administrationFee";
  }
  if (code === "56200" || n.includes("professional")) {
    return "professionalFees";
  }
  if (code === "58000" || (n.includes("interest") && n.includes("expense"))) {
    return "interestExpense";
  }
  if (n.includes("interest")) return "interestIncome";
  if (n.includes("organizational") || n.includes("organisation")) {
    return "organizationalExpenses";
  }
  if (code === "56100" || n.includes("bank")) return "bankFees";
  return "realizedPnl";
}

/** Signed MTD: keep GL sign. Do not abs() income — unrealized losses stay negative. */
function signedMtd(category: string, mtd: number): number {
  const cat = category.toLowerCase();
  if (cat === "expense" || cat === "expenses") {
    return mtd <= 0 ? mtd : -mtd;
  }
  return mtd;
}

export function fundPlBucketsFromRaw(raw: unknown): FundPlBuckets {
  const buckets = { ...EMPTY_BUCKETS };
  for (const row of parsePlLeafRows(raw)) {
    if (isMgmtOrPerfFee(row.accountCode, row.accountName)) continue;
    const key = classifyBucket(row.accountCode, row.accountName);
    if (key === "unrealizedPnl") {
      buckets[key] += row.mtdAmount;
      continue;
    }
    buckets[key] += signedMtd(row.category, row.mtdAmount);
  }
  return buckets;
}
