import { ApiError } from "../lib/errors";
import {
  fundNavPerShareFromTotals,
  roundUnits,
  unitsFromCapital,
} from "../lib/units/calculations";
import { resolveInvestorUnits } from "../lib/units/resolveUnits";
import * as fundNavConfigModel from "../models/fundNavConfig.model";
import * as fundPeriodNavModel from "../models/fundPeriodNav.model";
import * as investorNavModel from "../models/investorNav.model";
import * as investorModel from "../models/investor.model";
import { previousPeriod } from "../lib/periods";

export type NavPerShareSource = "period_nav" | "investor_nav" | "initial_nav";

export type ResolvedNavPerShare = {
  navPerShare: number;
  source: NavPerShareSource;
};

const NAV_NOT_SET_MSG =
  "NAV not set for this fund. Seed close NAV manually (POST /api/allocator/nav/seed) or set initial NAV (PATCH /api/allocator/nav/config).";

async function repairPeriodData(fundId: string, period: string) {
  await investorNavModel.repairManualSeedUnits(fundId, period);
  await investorNavModel.repairCarriedForwardUnits(fundId, period);
}

/**
 * Resolve NAV per share without throwing.
 * 1. investor_nav history → Total Fund Value ÷ Total Units
 * 2. else fund_nav_config.initial_nav (only if you set it explicitly)
 */
export async function resolveFundNavPerShare(
  fundId: string,
  period?: string,
): Promise<ResolvedNavPerShare | null> {
  if (period) {
    await repairPeriodData(fundId, period);
    const periodNav = await fundPeriodNavModel.getNavPerShare(fundId, period);
    if (periodNav) {
      return { navPerShare: periodNav, source: "period_nav" };
    }
  } else {
    const latest = await investorNavModel.getLatestPeriod(fundId);
    if (latest) await repairPeriodData(fundId, latest);
  }

  const totals = period
    ? await investorNavModel.getFundNavTotalsForPeriod(fundId, period)
    : await investorNavModel.getLatestFundNavTotals(fundId);

  if (totals) {
    const fromTotals = fundNavPerShareFromTotals(
      Number(totals.total_fund_value),
      Number(totals.total_units),
    );
    if (fromTotals != null) {
      return { navPerShare: fromTotals, source: "investor_nav" };
    }
  }

  if (period) {
    const prev = previousPeriod(period);
    const prevTotals = await investorNavModel.getFundNavTotalsForPeriod(
      fundId,
      prev,
    );
    if (prevTotals) {
      const fromPrev = fundNavPerShareFromTotals(
        Number(prevTotals.total_fund_value),
        Number(prevTotals.total_units),
      );
      if (fromPrev != null) {
        return { navPerShare: fromPrev, source: "investor_nav" };
      }
    }
  }

  const initialNav = await fundNavConfigModel.getInitialNav(fundId);
  if (initialNav != null) {
    return { navPerShare: initialNav, source: "initial_nav" };
  }

  if (period) {
    const manual = await investorNavModel.getManualNavPerShare(fundId, period);
    if (manual != null) {
      return { navPerShare: manual, source: "investor_nav" };
    }
  }

  return null;
}

/** Throws if NAV cannot be resolved — use for allocation etc. */
export async function getFundNavPerShare(
  fundId: string,
  period?: string,
): Promise<number> {
  const resolved = await resolveFundNavPerShare(fundId, period);
  if (!resolved) throw new ApiError(NAV_NOT_SET_MSG, 400);
  return resolved.navPerShare;
}

export async function getInvestorUnitsCapital(
  investorId: string,
  fundId: string,
  period?: string,
) {
  const capitalRow = await investorModel.getInvestorCapitalBreakdown(
    investorId,
    fundId,
  );
  const capital = Number(capitalRow?.capital ?? 0);
  const grossCapital = Number(capitalRow?.gross_capital ?? 0);
  const transactionCharges = Number(capitalRow?.transaction_charges ?? 0);
  const effectivePeriod =
    period ?? (await investorNavModel.getLatestPeriod(fundId)) ?? undefined;

  const resolved = await resolveFundNavPerShare(fundId, effectivePeriod);
  const stored = effectivePeriod
    ? await investorNavModel.getStoredUnits(investorId, fundId, effectivePeriod)
    : 0;

  return {
    units: resolveInvestorUnits(
      capital,
      resolved?.navPerShare ?? null,
      stored,
    ).toString(),
    capital: capital.toString(),
    gross_capital: grossCapital.toString(),
    transaction_charges: transactionCharges.toString(),
    nav_per_share: resolved?.navPerShare ?? null,
    nav_source: resolved?.source ?? null,
  };
}

type RowWithCapital = {
  capital: string | number;
  units?: string | number | null;
  id?: string;
  investor_id?: string;
};

function rowInvestorId(row: RowWithCapital): string | undefined {
  return row.id ?? row.investor_id;
}

/**
 * Units for a period — single source of truth:
 * investor_nav.units (old investor carry-forward) else capital ÷ NAV per share (new).
 */
export async function enrichWithUnits<T extends RowWithCapital>(
  fundId: string,
  rows: T[],
  period?: string,
): Promise<
  (T & {
    units: number;
    nav_per_share: number | null;
    pricing_nav_source: NavPerShareSource | null;
  })[]
> {
  const effectivePeriod =
    period ?? (await investorNavModel.getLatestPeriod(fundId)) ?? undefined;

  if (effectivePeriod) {
    await repairPeriodData(fundId, effectivePeriod);
  }

  const unitsMap = effectivePeriod
    ? await investorNavModel.getUnitsMapForPeriod(fundId, effectivePeriod)
    : new Map<string, number>();

  const resolved = await resolveFundNavPerShare(fundId, effectivePeriod);

  return rows.map((row) => {
    const investorId = rowInvestorId(row);
    const storedFromDb = investorId ? (unitsMap.get(investorId) ?? 0) : 0;
    const storedFromRow =
      row.units != null && Number(row.units) > 0 ? Number(row.units) : 0;
    const stored = storedFromDb > 0 ? storedFromDb : storedFromRow;

    const units = resolveInvestorUnits(
      Number(row.capital),
      resolved?.navPerShare ?? null,
      stored,
    );

    return {
      ...row,
      units,
      nav_per_share: resolved?.navPerShare ?? null,
      pricing_nav_source: resolved?.source ?? null,
    };
  });
}
