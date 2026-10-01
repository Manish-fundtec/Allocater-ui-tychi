import { ApiError } from "../lib/errors";
import { decryptFundField } from "../lib/encryption";
import * as investorModel from "../models/investor.model";
import * as unitsService from "./units.service";

export async function listInvestors(
  fundId: string,
  status: "all" | "active" | "exited",
  search: string,
  period?: string,
) {
  const rows = await investorModel.listInvestors(fundId, status, search);
  const enriched = await unitsService.enrichWithUnits(fundId, rows, period);
  return enriched.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    units: r.units,
    capital: Number(r.capital),
    gross_capital: Number(r.gross_capital ?? r.capital),
    transaction_charges: Number(r.transaction_charges ?? 0),
    nav_per_share: r.nav_per_share,
    pricing_nav_source: r.pricing_nav_source,
    status: r.status,
    created_at: r.created_at,
    current_closing_nav: r.current_closing_nav
      ? Number(r.current_closing_nav)
      : null,
    current_open_nav: r.current_closing_nav
      ? Number(r.current_closing_nav)
      : null,
    nav_period: r.nav_period,
  }));
}

export async function getInvestor(id: string) {
  const row = await investorModel.getInvestorById(id);
  if (!row) throw new ApiError("Investor not found", 404);

  const { units, capital, gross_capital, transaction_charges, nav_per_share, nav_source } =
    await unitsService.getInvestorUnitsCapital(row.id, row.fund_id);

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    units: Number(units),
    capital: Number(capital),
    gross_capital: Number(gross_capital),
    transaction_charges: Number(transaction_charges),
    nav_per_share,
    nav_source,
    status: row.status,
    created_at: row.created_at,
    fund_name: decryptFundField(row.fund_name) ?? "Fund",
  };
}

export async function patchInvestor(id: string, email?: string, phone?: string) {
  if (!email && phone === undefined) {
    throw new ApiError("Nothing to update", 400);
  }
  if (phone !== undefined) {
    throw new ApiError("Phone is not stored on portal_investors", 400);
  }
  await investorModel.updateInvestor(id, email);
  return getInvestor(id);
}
