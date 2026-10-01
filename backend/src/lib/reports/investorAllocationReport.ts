import { isMgmtFeeEligible, parseShareClass } from "../allocation/investorClass";
import { calculateHwmPerformanceFee } from "../allocation/performanceFee";
import { periodSubscriptionAmount } from "../allocation/subscriptionAmount";
import type { AllocationLineResult } from "../allocation/calculations";
import type { FundPlBuckets } from "../pl/parsePlRows";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function n2(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return round2(value);
}

function zeroAsNull(value: number | null | undefined): number | null {
  const rounded = n2(value);
  if (rounded == null || Math.abs(rounded) < 0.005) return null;
  return rounded;
}

export type InvestorAllocationRow = {
  investorId: string;
  investorCode: string;
  investorName: string;
  termsTitle: string;

  openingYtdShares: number | null;
  openingYtdNavPerShare: number | null;
  openingYtdNet: number | null;
  openingYtdGross: number | null;

  openingMtdShares: number | null;
  openingMtdNavPerShare: number | null;
  openingMtdNet: number | null;
  openingMtdGross: number | null;

  subRedShares: number | null;
  subRedIssuePrice: number | null;
  subRedAmount: number | null;

  equalizationCredit: number | null;
  adjShares: number | null;
  adjNavPerShare: number | null;
  adjNet: number | null;
  adjGross: number | null;
  priorHighWaterMark: number | null;
  adjHighWaterMark: number | null;
  highWaterMark: number | null;
  allocationPct: number | null;

  openingYtdPnl: number | null;
  realizedPnl: number | null;
  unrealizedPnl: number | null;
  onboardingFee: number | null;
  brokerageExpense: number | null;
  kycAmlFee: number | null;
  bankFees: number | null;
  administrationFee: number | null;
  professionalFees: number | null;
  interestIncome: number | null;
  interestExpense: number | null;
  organizationalExpenses: number | null;
  dividendIncome: number | null;
  grossMtdPnl: number | null;
  netMtdPnl: number | null;
  closingYtdPnl: number | null;
  netYtdPnl: number | null;

  navPrior: number | null;
  priorMgmtFeesAccrued: number | null;
  openingYtdMgmtFees: number | null;
  mtdMgmtFees: number | null;
  mgmtFees: number | null;

  gav: number | null;
  /** Investor's original first subscription date (carried every month). */
  subscriptionDate: string | null;
  /** Period-end NAV date. */
  navDate: string | null;
  /** ACT/365 days from subscription date through NAV date. */
  hurdleDays: number | null;
  /**
   * Hurdle Base ($) = Adj HWM × (1 + hurdle% × Days / 365).
   * Always populated when fees apply (audit trail). Distinct from the
   * Yes/No `hurdleCrossed` ("Hurdle Base (up 5%)") flag.
   */
  hurdleBase: number | null;
  /** Same dollar threshold as `hurdleBase` — Excel "Hurdle Base" column. */
  hurdleBaseAmount: number | null;
  /** "Hurdle Base (up 5%)" flag: Yes if GAV > Hurdle Base ($). */
  hurdleCrossed: "Yes" | "No" | null;
  adjustedPnl: number | null;
  tier1: number | null;
  tier2: number | null;
  perfFeesAccrual: number | null;
  perfFeesAccrued: number | null;
  perfFeesPnl: number | null;
  perfFeePaid: number | null;
  openingAccruedPerfFee: number | null;

  closingShares: number | null;
  closingNavPerShare: number | null;
  closingNet: number | null;
  closingGross: number | null;

  netMtdReturn: number | null;
  grossMtdReturn: number | null;
  absYtdReturn: number | null;
  netYtdCompounded: number | null;
  netYtdReturn: number | null;
  grossYtdReturn: number | null;

  originalIssuePrice: number | null;
  priorNetYtdCompounded: number | null;
};

export type PriorNavSnapshot = {
  units: number;
  net: number;
  gross: number;
  navPerShare: number | null;
  pnl: number | null;
};

export type PeriodFlow = {
  subscriptions: number;
  redemptions: number;
  transactionCharges?: number;
};

export type ReportCarryForward = {
  closingYtdPnl: number | null;
  ytdMgmtFees: number | null;
  adjHighWaterMark: number | null;
  originalIssuePrice: number | null;
  netYtdCompounded: number | null;
  accruedPerfFee: number | null;
  subscriptionDate: string | null;
};

export type BuildInvestorAllocationRowInput = {
  line: AllocationLineResult;
  investorCode: string;
  priorMtd: PriorNavSnapshot | null;
  priorYtd: PriorNavSnapshot | null;
  flow: PeriodFlow;
  issuePrice: number | null;
  fundPl: FundPlBuckets;
  /** First dealing date is in this month — opening MTD must be empty. */
  joinedThisPeriod?: boolean;
  /** Fund inception month: subscription amount is net capital (after charges). */
  inceptionPeriod?: boolean;
  carry?: ReportCarryForward | null;
  subscriptionDate?: string | null;
  navDate?: string | null;
};

function perShareRaw(total: number | null, shares: number | null): number | null {
  if (total == null || shares == null || shares <= 0) return null;
  return total / shares;
}

/** Prior period closing NAV/share for a share class, unrounded. */
export function priorClassNavPerShare(
  priorRows: InvestorAllocationRow[],
  termsTitle: string,
): number | null {
  const terms =
    parseShareClass(termsTitle) ?? (termsTitle?.trim() ? termsTitle.trim() : "A");
  let net = 0;
  let shares = 0;
  for (const row of priorRows) {
    const rowTerms =
      parseShareClass(row.termsTitle) ??
      (row.termsTitle?.trim() ? row.termsTitle.trim() : "A");
    if (rowTerms !== terms) continue;
    net += Number(row.closingNet) || 0;
    shares += Number(row.closingShares) || 0;
  }
  return shares > 0 ? net / shares : null;
}

export function fundNavPerShareFromRows(
  rows: InvestorAllocationRow[],
): number | null {
  let net = 0;
  let shares = 0;
  for (const row of rows) {
    net += Number(row.closingNet) || 0;
    shares += Number(row.closingShares) || 0;
  }
  return shares > 0 ? net / shares : null;
}

/**
 * Subscription issue price: prior closing NAV/share at full precision.
 * Inception month is the original $2000 issue. Do not round to 2 decimals.
 */
export function resolveSubscriptionIssuePrice(opts: {
  inceptionPeriod?: boolean;
  joinedThisPeriod?: boolean;
  priorNavPerShare?: number | null;
  classNavPerShare?: number | null;
  fundNavPerShare?: number | null;
}): number | null {
  if (opts.inceptionPeriod) return 2000;
  const prior = opts.priorNavPerShare;
  if (!opts.joinedThisPeriod && prior != null && prior > 0) return prior;
  if (opts.classNavPerShare != null && opts.classNavPerShare > 0) {
    return opts.classNavPerShare;
  }
  if (opts.fundNavPerShare != null && opts.fundNavPerShare > 0) {
    return opts.fundNavPerShare;
  }
  return null;
}

function perShare(total: number | null, shares: number | null): number | null {
  const raw = perShareRaw(total, shares);
  return raw == null ? null : n2(raw);
}

function allocate(amount: number, sharePct: number): number {
  return round2(amount * (sharePct / 100));
}

/** Excel: (NAV_Prior × annual% / 12) × (accrual days / days in month).
 * Full-month investors pass periodDays === daysInMonth (no proration). */
function mgmtFeeOnGav(
  gav: number,
  mgmtRatePct: number,
  periodDays: number,
  daysInMonth: number,
): number {
  if (gav <= 0 || mgmtRatePct <= 0 || periodDays <= 0 || daysInMonth <= 0) {
    return 0;
  }
  const monthlyRate = mgmtRatePct / 100 / 12;
  const dayFactor = periodDays >= daysInMonth ? 1 : periodDays / daysInMonth;
  return gav * monthlyRate * dayFactor;
}

function pctReturn(pnl: number | null, base: number | null): number | null {
  if (pnl == null || base == null || Math.abs(base) < 0.005) return null;
  return pnl / base;
}

/** (closing NAV/share − issue price) / issue price — Excel fraction. */
function pctReturnFromNav(
  closingNavPerShare: number | null,
  issuePrice: number | null,
): number | null {
  if (
    closingNavPerShare == null ||
    issuePrice == null ||
    Math.abs(issuePrice) < 0.005
  ) {
    return null;
  }
  return (closingNavPerShare - issuePrice) / issuePrice;
}

export function buildInvestorAllocationRow(
  input: BuildInvestorAllocationRowInput,
): InvestorAllocationRow {
  const {
    line,
    investorCode,
    priorYtd,
    flow,
    issuePrice,
    fundPl,
    joinedThisPeriod,
    inceptionPeriod,
    carry,
    navDate,
  } = input;
  const priorMtd = joinedThisPeriod ? null : input.priorMtd;
  const sharePct = Number(line.share_pct) || 0;
  const terms =
    parseShareClass(line.share_class) ??
    (line.share_class?.trim() ? line.share_class.trim() : "A");

  const sub = periodSubscriptionAmount({
    subscriptions: flow.subscriptions,
    redemptions: flow.redemptions,
    transactionCharges: flow.transactionCharges ?? 0,
    issuePrice,
    shareClass: line.share_class,
    applyOnboardingCharges: Boolean(inceptionPeriod && joinedThisPeriod),
  });
  const hasFlow = Math.abs(sub.net) >= 0.005 || Math.abs(sub.gross) >= 0.005;
  const subRedAmount = hasFlow ? n2(sub.net) : null;
  const subRedIssuePrice =
    hasFlow && issuePrice && issuePrice > 0 ? issuePrice : null;
  const subRedShares =
    subRedAmount != null && subRedIssuePrice && subRedIssuePrice > 0
      ? n2(subRedAmount / subRedIssuePrice)
      : hasFlow && line.units > 0 && !priorMtd
        ? n2(line.units)
        : null;

  const openingMtdShares = priorMtd?.units ? n2(priorMtd.units) : null;
  const openingMtdNet = priorMtd?.net ? n2(priorMtd.net) : null;
  const openingMtdGross = openingMtdNet;
  const openingMtdNavPerShare =
    priorMtd?.navPerShare ?? perShare(openingMtdNet, openingMtdShares);

  const openingYtdShares = priorYtd?.units ? n2(priorYtd.units) : null;
  const openingYtdNet = priorYtd?.net ? n2(priorYtd.net) : null;
  const openingYtdGross = openingYtdNet;
  const openingYtdNavPerShare =
    priorYtd?.navPerShare ?? perShare(openingYtdNet, openingYtdShares);

  const adjShares = n2(
    (openingMtdShares ?? 0) + (subRedShares ?? 0) || line.units,
  );
  const adjNet = n2((openingMtdNet ?? 0) + (subRedAmount ?? 0) || sub.net);
  const adjGross = adjNet;
  const adjNavPerShare =
    subRedIssuePrice ?? perShare(adjNet, adjShares) ?? n2(issuePrice);

  const grossMtdPnl = n2(line.gross_profit);
  let unrealizedPnl = allocate(fundPl.unrealizedPnl, sharePct);
  if ((grossMtdPnl ?? 0) < 0 && unrealizedPnl > 0) {
    unrealizedPnl = -unrealizedPnl;
  }
  const onboardingFee = allocate(fundPl.onboardingFee, sharePct);
  const brokerageExpense = allocate(fundPl.brokerageExpense, sharePct);
  const kycAmlFee = allocate(fundPl.kycAmlFee, sharePct);
  const bankFees = allocate(fundPl.bankFees, sharePct);
  const administrationFee = allocate(fundPl.administrationFee, sharePct);
  const professionalFees = allocate(fundPl.professionalFees, sharePct);
  const interestIncome = allocate(fundPl.interestIncome, sharePct);
  const interestExpense = allocate(fundPl.interestExpense, sharePct);
  const organizationalExpenses = allocate(
    fundPl.organizationalExpenses,
    sharePct,
  );
  const dividendIncome = allocate(fundPl.dividendIncome, sharePct);

  const pnlSumExceptRealized = round2(
    unrealizedPnl +
      onboardingFee +
      brokerageExpense +
      kycAmlFee +
      bankFees +
      administrationFee +
      professionalFees +
      interestIncome +
      interestExpense +
      organizationalExpenses +
      dividendIncome,
  );
  const realizedAdj = round2((grossMtdPnl ?? 0) - pnlSumExceptRealized);

  const openingYtdPnl = joinedThisPeriod
    ? 0
    : n2(carry?.closingYtdPnl ?? 0) ?? 0;
  const openingYtdMgmtFees = joinedThisPeriod
    ? 0
    : n2(carry?.ytdMgmtFees ?? 0) ?? 0;
  const priorHighWaterMark = joinedThisPeriod
    ? 0
    : n2(carry?.adjHighWaterMark ?? 0) ?? 0;
  const adjHighWaterMark = n2(
    priorHighWaterMark + (hasFlow ? (subRedAmount ?? 0) : 0),
  );
  const originalIssuePrice =
    (joinedThisPeriod ? issuePrice : carry?.originalIssuePrice) ?? issuePrice;
  const priorNetYtdCompounded = joinedThisPeriod
    ? 0
    : (carry?.netYtdCompounded ?? 0);
  const subscriptionDate =
    input.subscriptionDate ??
    (joinedThisPeriod ? null : carry?.subscriptionDate ?? null);
  const openingAccruedPerfFee = joinedThisPeriod
    ? null
    : zeroAsNull(carry?.accruedPerfFee ?? 0);

  const mgmtFees = line.mgmt_fee > 0.00005 ? n2(-line.mgmt_fee) : null;
  const netMtdPnl = n2((grossMtdPnl ?? 0) + (mgmtFees ?? 0));
  const closingYtdPnl = n2((openingYtdPnl ?? 0) + (grossMtdPnl ?? 0));
  const netYtdPnl = n2(
    (closingYtdPnl ?? 0) + openingYtdMgmtFees + (mgmtFees ?? 0),
  );

  const navPrior = n2((adjNet ?? 0) + (grossMtdPnl ?? 0));
  const gav = n2((navPrior ?? 0) + (mgmtFees ?? 0));
  const closingNet = n2((adjNet ?? 0) + (netMtdPnl ?? 0));
  const closingGross = closingNet;
  const closingShares = adjShares ?? n2(line.units);
  const closingNavPerShare = perShare(closingNet, closingShares);

  const ror = pctReturnFromNav(closingNavPerShare, originalIssuePrice);

  return {
    investorId: line.investor_id,
    investorCode: investorCode || "—",
    investorName: line.investor_name,
    termsTitle: terms,

    openingYtdShares,
    openingYtdNavPerShare,
    openingYtdNet,
    openingYtdGross,

    openingMtdShares,
    openingMtdNavPerShare,
    openingMtdNet,
    openingMtdGross,

    subRedShares,
    subRedIssuePrice,
    subRedAmount,

    equalizationCredit: null,
    adjShares,
    adjNavPerShare,
    adjNet,
    adjGross,
    priorHighWaterMark,
    adjHighWaterMark,
    highWaterMark: adjHighWaterMark,
    allocationPct: sharePct / 100,

    openingYtdPnl,
    realizedPnl: zeroAsNull(realizedAdj),
    unrealizedPnl: zeroAsNull(unrealizedPnl),
    onboardingFee: zeroAsNull(onboardingFee),
    brokerageExpense: zeroAsNull(brokerageExpense),
    kycAmlFee: zeroAsNull(kycAmlFee),
    bankFees: zeroAsNull(bankFees),
    administrationFee: zeroAsNull(administrationFee),
    professionalFees: zeroAsNull(professionalFees),
    interestIncome: zeroAsNull(interestIncome),
    interestExpense: zeroAsNull(interestExpense),
    organizationalExpenses: zeroAsNull(organizationalExpenses),
    dividendIncome: zeroAsNull(dividendIncome),
    grossMtdPnl,
    netMtdPnl,
    closingYtdPnl,
    netYtdPnl,

    navPrior,
    priorMgmtFeesAccrued: openingYtdMgmtFees,
    openingYtdMgmtFees,
    mtdMgmtFees: mgmtFees,
    mgmtFees,

    gav,
    subscriptionDate,
    navDate: navDate ?? null,
    hurdleDays: null,
    hurdleBase: null,
    hurdleBaseAmount: null,
    hurdleCrossed: null,
    adjustedPnl: null,
    tier1: null,
    tier2: null,
    perfFeesAccrual: null,
    perfFeesAccrued: null,
    perfFeesPnl: null,
    perfFeePaid: null,
    openingAccruedPerfFee,

    closingShares,
    closingNavPerShare,
    closingNet,
    closingGross,

    netMtdReturn: ror,
    grossMtdReturn: ror,
    absYtdReturn: ror,
    netYtdCompounded: ror,
    netYtdReturn: ror,
    grossYtdReturn: ror,

    originalIssuePrice,
    priorNetYtdCompounded,
  };
}

const SUM_KEYS: (keyof InvestorAllocationRow)[] = [
  "openingYtdShares",
  "openingYtdNet",
  "openingYtdGross",
  "openingMtdShares",
  "openingMtdNet",
  "openingMtdGross",
  "subRedShares",
  "subRedAmount",
  "equalizationCredit",
  "adjShares",
  "adjNet",
  "adjGross",
  "priorHighWaterMark",
  "adjHighWaterMark",
  "highWaterMark",
  "openingYtdPnl",
  "realizedPnl",
  "unrealizedPnl",
  "onboardingFee",
  "brokerageExpense",
  "kycAmlFee",
  "bankFees",
  "administrationFee",
  "professionalFees",
  "interestIncome",
  "interestExpense",
  "organizationalExpenses",
  "dividendIncome",
  "grossMtdPnl",
  "netMtdPnl",
  "closingYtdPnl",
  "netYtdPnl",
  "navPrior",
  "priorMgmtFeesAccrued",
  "openingYtdMgmtFees",
  "mtdMgmtFees",
  "mgmtFees",
  "gav",
  "hurdleBase",
  "hurdleBaseAmount",
  "adjustedPnl",
  "tier1",
  "tier2",
  "perfFeesAccrual",
  "perfFeesAccrued",
  "perfFeesPnl",
  "perfFeePaid",
  "openingAccruedPerfFee",
  "closingShares",
  "closingNet",
  "closingGross",
];

export function buildAllocationTotals(
  rows: InvestorAllocationRow[],
): InvestorAllocationRow {
  const totals = {
    investorId: "total",
    investorCode: "Total",
    investorName: "",
    termsTitle: "",
  } as InvestorAllocationRow;

  for (const key of SUM_KEYS) {
    const sum = rows.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
    (totals as Record<string, unknown>)[key] = zeroAsNull(sum);
  }

  const issuePrices = rows
    .map((r) => r.subRedIssuePrice)
    .filter((v): v is number => v != null && v > 0);
  const uniqueIssue = new Set(issuePrices.map((v) => v.toFixed(2)));
  totals.subRedIssuePrice =
    uniqueIssue.size === 1 ? issuePrices[0] : null;

  const adjNavs = rows
    .map((r) => r.adjNavPerShare)
    .filter((v): v is number => v != null && v > 0);
  const uniqueAdjNav = new Set(adjNavs.map((v) => v.toFixed(2)));
  totals.adjNavPerShare = uniqueAdjNav.size === 1 ? adjNavs[0] : perShare(totals.adjNet, totals.adjShares);

  totals.openingYtdNavPerShare = perShare(
    totals.openingYtdNet,
    totals.openingYtdShares,
  );
  totals.openingMtdNavPerShare = perShare(
    totals.openingMtdNet,
    totals.openingMtdShares,
  );
  totals.closingNavPerShare = perShare(totals.closingNet, totals.closingShares);
  totals.allocationPct = rows.length > 0 ? 1 : null;
  totals.highWaterMark = totals.adjHighWaterMark;
  totals.subscriptionDate = null;
  totals.navDate = null;
  totals.hurdleDays = null;
  totals.hurdleCrossed = null;
  totals.netMtdReturn = null;
  totals.grossMtdReturn = null;
  totals.absYtdReturn = null;
  totals.netYtdCompounded = null;
  totals.netYtdReturn = null;
  totals.grossYtdReturn = null;
  return totals;
}

/** Recompute allocation % from adjusted net capital (Excel). Stored as fraction. */
export function applyAllocationPctFromAdjNet(
  rows: InvestorAllocationRow[],
): void {
  const total = rows.reduce((sum, row) => sum + (Number(row.adjNet) || 0), 0);
  if (total <= 0) return;
  for (const row of rows) {
    row.allocationPct = (Number(row.adjNet) || 0) / total;
  }
}

export type PnlRecomputeFeeOpts = {
  mgmtFeePct: number;
  hurdleRatePct: number;
  perfFeePct: number;
  daysInMonth: number;
  mgmtDaysById: Map<string, number>;
  applyFees: boolean;
  navDate: string;
  subscriptionDateById: Map<string, string>;
};

/**
 * Re-split fund P&L using current Adjusted Opening net (after subscription
 * amount fixes). Stored allocation_lines can lag (e.g. Wendi still on 49.75).
 */
export function applyPnlFromAdjNet(
  rows: InvestorAllocationRow[],
  fundPl: FundPlBuckets,
  fundNetMtd: number,
  fee: PnlRecomputeFeeOpts,
): void {
  applyAllocationPctFromAdjNet(rows);
  const grossById = new Map<string, number>();
  let allocatedGross = 0;
  for (const row of rows) {
    const frac = Number(row.allocationPct) || 0;
    const grossMtd = round2(fundNetMtd * frac);
    grossById.set(row.investorId, grossMtd);
    allocatedGross = round2(allocatedGross + grossMtd);
  }
  if (rows.length > 0) {
    const residual = round2(round2(fundNetMtd) - allocatedGross);
    if (Math.abs(residual) >= 0.005) {
      const last = rows[rows.length - 1];
      grossById.set(
        last.investorId,
        round2((grossById.get(last.investorId) ?? 0) + residual),
      );
    }
  }
  for (const row of rows) {
    const frac = Number(row.allocationPct) || 0;
    const pct = frac * 100;
    const grossMtd = grossById.get(row.investorId) ?? 0;
    let unrealizedPnl = allocate(fundPl.unrealizedPnl, pct);
    if (grossMtd < 0 && unrealizedPnl > 0) {
      unrealizedPnl = -unrealizedPnl;
    }
    const onboardingFee = allocate(fundPl.onboardingFee, pct);
    const brokerageExpense = allocate(fundPl.brokerageExpense, pct);
    const kycAmlFee = allocate(fundPl.kycAmlFee, pct);
    const bankFees = allocate(fundPl.bankFees, pct);
    const administrationFee = allocate(fundPl.administrationFee, pct);
    const professionalFees = allocate(fundPl.professionalFees, pct);
    const interestIncome = allocate(fundPl.interestIncome, pct);
    const interestExpense = allocate(fundPl.interestExpense, pct);
    const organizationalExpenses = allocate(
      fundPl.organizationalExpenses,
      pct,
    );
    const dividendIncome = allocate(fundPl.dividendIncome, pct);
    const pnlSumExceptRealized = round2(
      unrealizedPnl +
        onboardingFee +
        brokerageExpense +
        kycAmlFee +
        bankFees +
        administrationFee +
        professionalFees +
        interestIncome +
        interestExpense +
        organizationalExpenses +
        dividendIncome,
    );
    const realizedAdj = round2(grossMtd - pnlSumExceptRealized);
    const navPrior = round2((Number(row.adjNet) || 0) + grossMtd);
    const mgmtDays = fee.mgmtDaysById.get(row.investorId) ?? 0;
    const mgmtFee =
      fee.applyFees && isMgmtFeeEligible(row.termsTitle)
        ? mgmtFeeOnGav(navPrior, fee.mgmtFeePct, mgmtDays, fee.daysInMonth)
        : 0;
    const mtdMgmtFees = mgmtFee > 0.00005 ? n2(-mgmtFee) : null;
    const gav = n2(navPrior + (mtdMgmtFees ?? 0));
    const subscriptionDate =
      fee.subscriptionDateById.get(row.investorId) ?? row.subscriptionDate;
    const perf = fee.applyFees
      ? calculateHwmPerformanceFee({
          gav: gav ?? 0,
          adjHighWaterMark: Number(row.adjHighWaterMark) || 0,
          hurdleRatePct: fee.hurdleRatePct,
          perfFeePct: fee.perfFeePct,
          subscriptionDate,
          navDate: fee.navDate,
          openingAccruedPerfFee: Number(row.openingAccruedPerfFee) || 0,
        })
      : null;
    const openingYtdPnl = Number(row.openingYtdPnl) || 0;
    const closingYtdPnl = n2(openingYtdPnl + grossMtd);
    const openingYtdMgmt = Number(row.openingYtdMgmtFees) || 0;
    const netMtdPnl = n2(
      grossMtd + (mtdMgmtFees ?? 0) + (perf?.perfFeesPnl ?? 0),
    );
    const netYtdPnl = n2(
      (closingYtdPnl ?? 0) +
        openingYtdMgmt +
        (mtdMgmtFees ?? 0) +
        (perf?.perfFeesAccrued ?? 0),
    );
    const closingNet = n2((Number(row.adjNet) || 0) + (netMtdPnl ?? 0));
    const closingShares = row.closingShares ?? row.adjShares;

    row.grossMtdPnl = n2(grossMtd);
    row.netMtdPnl = netMtdPnl;
    row.realizedPnl = zeroAsNull(realizedAdj);
    row.unrealizedPnl = zeroAsNull(unrealizedPnl);
    row.onboardingFee = zeroAsNull(onboardingFee);
    row.brokerageExpense = zeroAsNull(brokerageExpense);
    row.kycAmlFee = zeroAsNull(kycAmlFee);
    row.bankFees = zeroAsNull(bankFees);
    row.administrationFee = zeroAsNull(administrationFee);
    row.professionalFees = zeroAsNull(professionalFees);
    row.interestIncome = zeroAsNull(interestIncome);
    row.interestExpense = zeroAsNull(interestExpense);
    row.organizationalExpenses = zeroAsNull(organizationalExpenses);
    row.dividendIncome = zeroAsNull(dividendIncome);
    row.closingYtdPnl = closingYtdPnl;
    row.netYtdPnl = netYtdPnl;
    row.navPrior = n2(navPrior);
    row.mtdMgmtFees = mtdMgmtFees;
    row.mgmtFees = mtdMgmtFees;
    row.priorMgmtFeesAccrued = n2(openingYtdMgmt);
    row.gav = gav;
    row.subscriptionDate = subscriptionDate ?? null;
    row.navDate = fee.applyFees ? fee.navDate : row.navDate;
    row.hurdleDays = perf?.hurdleDays ?? null;
    row.hurdleBase = perf ? perf.hurdleBaseAmount : null;
    row.hurdleBaseAmount = row.hurdleBase;
    row.hurdleCrossed = perf?.hurdleCrossed ?? null;
    row.adjustedPnl = perf?.adjustedPnl ?? null;
    row.tier1 = perf?.tier1 ?? null;
    row.tier2 = perf?.tier2 ?? null;
    row.perfFeesAccrual = perf?.perfFeesAccrued ?? null;
    row.perfFeesAccrued = perf?.perfFeesAccrued ?? null;
    row.perfFeesPnl = perf?.perfFeesPnl ?? null;
    row.openingAccruedPerfFee = perf?.openingAccruedPerfFee ?? row.openingAccruedPerfFee;
    row.closingNet = closingNet;
    row.closingGross = closingNet;
    row.closingNavPerShare = perShare(closingNet, closingShares);
  }
}

/**
 * NAV/share = Net Capital / Shares.
 * Net MTD = (close − opening MTD or issue) / opening.
 * Abs YTD = (close − original issue price) / original issue price.
 * Net YTD compounded = (1 + prior YTD) × (1 + Net MTD) − 1.
 */
export function applyClassNavReturns(
  rows: InvestorAllocationRow[],
  issuePrice: number | null,
): void {
  for (const row of rows) {
    const ownPs = perShareRaw(row.closingNet, row.closingShares);
    row.closingNavPerShare = ownPs == null ? null : n2(ownPs);
    const openPs =
      row.openingMtdNavPerShare ??
      row.subRedIssuePrice ??
      row.originalIssuePrice ??
      issuePrice;
    const originalIssue = row.originalIssuePrice ?? issuePrice;
    row.netMtdReturn = pctReturnFromNav(ownPs, openPs);
    const gavPs = perShareRaw(row.gav, row.closingShares);
    row.grossMtdReturn = pctReturnFromNav(gavPs ?? ownPs, openPs);
    row.absYtdReturn = pctReturnFromNav(ownPs, originalIssue);
    row.netYtdReturn = row.absYtdReturn;
    row.grossYtdReturn = row.absYtdReturn;
    const priorC = Number(row.priorNetYtdCompounded) || 0;
    const r = row.netMtdReturn ?? 0;
    row.netYtdCompounded = (1 + priorC) * (1 + r) - 1;
  }
}

export function buildCheckRow(
  rows: InvestorAllocationRow[],
  totals: InvestorAllocationRow,
): InvestorAllocationRow {
  const check = {
    investorId: "check",
    investorCode: "Check",
    investorName: "",
    termsTitle: "",
  } as InvestorAllocationRow;

  const pctSum = rows.reduce((sum, row) => sum + (Number(row.allocationPct) || 0), 0);
  check.allocationPct = n2(pctSum - 1);

  const pnlSplit = rows.reduce((sum, row) => {
    return (
      sum +
      (Number(row.realizedPnl) || 0) +
      (Number(row.unrealizedPnl) || 0) +
      (Number(row.onboardingFee) || 0) +
      (Number(row.brokerageExpense) || 0) +
      (Number(row.kycAmlFee) || 0) +
      (Number(row.bankFees) || 0) +
      (Number(row.administrationFee) || 0) +
      (Number(row.professionalFees) || 0) +
      (Number(row.interestIncome) || 0) +
      (Number(row.interestExpense) || 0) +
      (Number(row.organizationalExpenses) || 0) +
      (Number(row.dividendIncome) || 0)
    );
  }, 0);
  check.grossMtdPnl = n2(pnlSplit - (Number(totals.grossMtdPnl) || 0));
  check.netMtdPnl = n2(
    (Number(totals.grossMtdPnl) || 0) +
      (Number(totals.mtdMgmtFees) || 0) +
      (Number(totals.perfFeesPnl) || 0) -
      (Number(totals.netMtdPnl) || 0),
  );
  check.closingYtdPnl = n2(
    (Number(totals.openingYtdPnl) || 0) +
      (Number(totals.grossMtdPnl) || 0) -
      (Number(totals.closingYtdPnl) || 0),
  );
  check.netYtdPnl = n2(
    (Number(totals.closingYtdPnl) || 0) +
      (Number(totals.openingYtdMgmtFees) || 0) +
      (Number(totals.mtdMgmtFees) || 0) +
      (Number(totals.perfFeesAccrued) || 0) -
      (Number(totals.netYtdPnl) || 0),
  );

  const closingFromAdj = n2(
    (Number(totals.adjNet) || 0) + (Number(totals.netMtdPnl) || 0),
  );
  check.closingNet = n2((closingFromAdj ?? 0) - (Number(totals.closingNet) || 0));
  check.closingGross = check.closingNet;
  check.subRedAmount = n2(
    (Number(totals.subRedAmount) || 0) -
      rows.reduce((sum, row) => sum + (Number(row.subRedAmount) || 0), 0),
  );
  return check;
}
