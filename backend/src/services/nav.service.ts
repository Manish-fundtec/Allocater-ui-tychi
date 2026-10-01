import { ApiError } from "../lib/errors";
import * as investorNavModel from "../models/investorNav.model";
import * as fundNavConfigModel from "../models/fundNavConfig.model";
import * as fundPeriodNavModel from "../models/fundPeriodNav.model";
import * as unitsService from "./units.service";
import * as navPeriodService from "./navPeriod.service";
import { roundUnits, unitsFromCapital } from "../lib/units/calculations";
import { roundNav } from "../lib/nav/periodNav";
import * as investorModel from "../models/investor.model";
import { getPeriodBounds } from "../lib/pl/periodBounds";
import { isDealingOnOrBeforePeriodEnd } from "../lib/pl/periodDays";

/** UI close_nav/open_nav = NAV per share (fund-level); DB opening_nav/closing_nav = total account value */
function withLegacyNavFields(
  openingTotal: number | null,
  closingTotal: number | null,
  units: number,
  fundNavPerShare?: number | null,
) {
  const navPerShareOpen =
    fundNavPerShare != null && fundNavPerShare > 0
      ? fundNavPerShare
      : openingTotal != null && units > 0
        ? openingTotal / units
        : openingTotal;
  const navPerShareClose =
    closingTotal != null && units > 0
      ? closingTotal / units
      : closingTotal;
  return {
    opening_nav: openingTotal,
    closing_nav: closingTotal,
    close_nav: navPerShareOpen,
    open_nav: navPerShareClose,
  };
}

export async function getNavHistory(investorId: string, fundId: string) {
  const rows = await investorNavModel.listHistory(investorId, fundId);
  const resolved = await unitsService.resolveFundNavPerShare(fundId);
  return rows.map((r) => {
    const opening = r.opening_nav != null ? Number(r.opening_nav) : null;
    const closing = r.closing_nav != null ? Number(r.closing_nav) : null;
    const units = Number(r.units);
    return {
      period: r.period,
      ...withLegacyNavFields(opening, closing, units),
      profit: r.profit != null ? Number(r.profit) : null,
      nav_source: r.nav_source,
      units: Number(r.units),
      capital: Number(r.capital),
      nav_per_share: resolved?.navPerShare ?? null,
    };
  });
}

export async function getNavAll(fundId: string, period?: string) {
  if (period) {
    await navPeriodService.ensurePeriodOpened(fundId, period);
    await investorNavModel.repairManualSeedUnits(fundId, period);
  }

  const rows = period
    ? await investorNavModel.listForFundPeriod(fundId, period)
    : await investorNavModel.listAllForFund(fundId);

  const enriched = await unitsService.enrichWithUnits(
    fundId,
    rows,
    period,
  );

  let periodRows = enriched;
  if (period) {
    const bounds = await getPeriodBounds(fundId, period);
    const firstDealing = await investorModel.getInvestorFirstDealingDates(
      fundId,
      enriched.map((r) => r.investor_id),
    );
    periodRows = enriched.filter((r) =>
      isDealingOnOrBeforePeriodEnd(firstDealing.get(r.investor_id), bounds.end),
    );
  }

  return periodRows.map((r) => {
    const row = r as typeof r & {
      gross_capital?: string;
      transaction_charges?: string;
    };
    const opening = row.opening_nav != null ? Number(row.opening_nav) : null;
    const closing = row.closing_nav != null ? Number(row.closing_nav) : null;
    const units = row.units;
    return {
      investor_id: row.investor_id,
      investor_name: row.investor_name,
      period: row.period,
      ...withLegacyNavFields(opening, closing, units, row.nav_per_share),
      profit: row.profit != null ? Number(row.profit) : null,
      nav_source: row.nav_source,
      units: row.units,
      capital: Number(row.capital),
      gross_capital: Number(row.gross_capital ?? row.capital),
      transaction_charges: Number(row.transaction_charges ?? 0),
      nav_per_share: row.nav_per_share,
      pricing_nav_source: row.pricing_nav_source,
      opening_nav: opening,
    };
  });
}

type SeedEntryInput = {
  investorId: string;
  transactionCharges?: number;
};

async function computeSeedRow(
  fundId: string,
  period: string,
  investorId: string,
  navPerShare: number,
  transactionChargesOverride?: number,
) {
  const breakdown = await investorModel.getInvestorCapitalBreakdown(
    investorId,
    fundId,
  );
  const grossCapital = Number(breakdown?.gross_capital ?? 0);
  const transactionCharges =
    transactionChargesOverride ??
    Number(breakdown?.transaction_charges ?? 0);
  const netCapital = grossCapital - transactionCharges;

  const prev = await investorNavModel.getPreviousPeriodNav(
    investorId,
    fundId,
    period,
  );
  const hasPriorNav =
    prev != null &&
    (Number(prev.closing_nav) > 0 || Number(prev.opening_nav) > 0);

  if (hasPriorNav) {
    const carriedUnits = Number(prev.units ?? 0);
    const openingNav = Number(prev.closing_nav ?? prev.opening_nav ?? 0);
    return {
      grossCapital,
      transactionCharges,
      netCapital,
      navPerShare,
      units:
        carriedUnits > 0
          ? carriedUnits
          : roundUnits(unitsFromCapital(netCapital, navPerShare)),
      openingNav: openingNav > 0 ? openingNav : netCapital,
      isNewInvestor: false,
    };
  }

  const units = roundUnits(unitsFromCapital(netCapital, navPerShare));
  return {
    grossCapital,
    transactionCharges,
    netCapital,
    navPerShare,
    units,
    openingNav: netCapital,
    isNewInvestor: true,
  };
}

export async function getSeedPreview(
  fundId: string,
  period: string,
  navPerShare: number,
) {
  const investors = await investorModel.listInvestors(fundId, "active", "");
  const rows = await Promise.all(
    investors.map(async (inv) => {
      const computed = await computeSeedRow(
        fundId,
        period,
        inv.id,
        navPerShare,
      );
      return {
        investor_id: inv.id,
        investor_name: inv.name,
        gross_capital: computed.grossCapital,
        transaction_charges: computed.transactionCharges,
        net_capital: computed.netCapital,
        nav_per_share: navPerShare,
        units: computed.units,
        opening_nav: computed.openingNav,
        is_new_investor: computed.isNewInvestor,
      };
    }),
  );
  return { period, nav_per_share: navPerShare, investors: rows };
}

export async function seedNav(params: {
  fundId: string;
  period: string;
  navPerShare: number;
  entries: SeedEntryInput[];
}) {
  const { fundId, period, navPerShare, entries } = params;
  if (!navPerShare || navPerShare <= 0) {
    throw new ApiError("NAV per unit must be greater than zero", 400);
  }

  await fundPeriodNavModel.upsertPeriodNav(fundId, period, navPerShare);

  let count = 0;
  for (const entry of entries) {
    if (entry.transactionCharges != null) {
      await investorModel.setInvestorTransactionCharges(
        entry.investorId,
        fundId,
        entry.transactionCharges,
      );
    }

    const computed = await computeSeedRow(
      fundId,
      period,
      entry.investorId,
      navPerShare,
      entry.transactionCharges,
    );

    if (computed.netCapital <= 0 && computed.isNewInvestor) {
      throw new ApiError(
        `Net capital must be positive for new investor seed (${entry.investorId})`,
        400,
      );
    }

    await investorNavModel.seedNav({
      investorId: entry.investorId,
      fundId,
      period,
      openingNavTotal: roundNav(computed.openingNav),
      units: computed.units.toString(),
      capital: computed.netCapital.toString(),
      navPerShare,
      grossCapital: computed.grossCapital,
      transactionCharges: computed.transactionCharges,
    });
    count++;
  }

  return { ok: true, count, nav_per_share: navPerShare };
}

/** @deprecated Use seedNav with navPerShare — kept for legacy closeNav alias */
export async function seedNavLegacy(
  entries: {
    investorId: string;
    fundId: string;
    period: string;
    closeNav: number;
    transactionCharges?: number;
  }[],
) {
  if (!entries.length) return { ok: true, count: 0 };
  const { fundId, period, closeNav } = entries[0];
  return seedNav({
    fundId,
    period,
    navPerShare: closeNav,
    entries: entries.map((e) => ({
      investorId: e.investorId,
      transactionCharges: e.transactionCharges,
    })),
  });
}

export async function carryForward(fundId: string, period: string) {
  return navPeriodService.carryForwardPeriod(fundId, period);
}

export async function openPeriod(fundId: string, period: string) {
  return navPeriodService.ensurePeriodOpened(fundId, period);
}

export async function getNavConfig(fundId: string) {
  const resolved = await unitsService.resolveFundNavPerShare(fundId);
  const config = await fundNavConfigModel.getConfig(fundId);
  const totals = await investorNavModel.getLatestFundNavTotals(fundId);

  return {
    fund_id: fundId,
    initial_nav: config.initial_nav,
    current_nav_per_share: resolved?.navPerShare ?? null,
    nav_source: resolved?.source ?? null,
    total_fund_value: totals ? Number(totals.total_fund_value) : null,
    total_units: totals ? Number(totals.total_units) : null,
    nav_period: totals?.period ?? null,
  };
}

export async function updateNavConfig(fundId: string, initialNav: number) {
  const updated = await fundNavConfigModel.upsertInitialNav(fundId, initialNav);
  return {
    ...updated,
    current_nav_per_share: await unitsService.getFundNavPerShare(fundId),
  };
}
