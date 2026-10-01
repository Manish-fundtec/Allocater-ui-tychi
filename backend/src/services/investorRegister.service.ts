import { ApiError } from "../lib/errors";
import { parseShareClass } from "../lib/allocation/investorClass";
import * as fundModel from "../models/fund.model";
import * as investorModel from "../models/investor.model";
import * as unitsService from "./units.service";

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

export async function getInvestorRegister(fundId: string) {
  const fund = await fundModel.getById(fundId);
  if (!fund) throw new ApiError("Fund not found", 404);

  const [rows, dealingRows] = await Promise.all([
    investorModel.listRegisterInvestors(fundId),
    investorModel.listRegisterDealings(fundId),
  ]);

  const enriched = await unitsService.enrichWithUnits(fundId, rows);

  const dealingsByInvestor = new Map<string, typeof dealingRows>();
  for (const row of dealingRows) {
    const list = dealingsByInvestor.get(row.investor_id) ?? [];
    list.push(row);
    dealingsByInvestor.set(row.investor_id, list);
  }

  const investors = enriched.map((row) => {
    const dealings = (dealingsByInvestor.get(row.id) ?? []).map((d) => ({
      tradeDate: isoDate(d.trade_date),
      dealingDate: isoDate(d.dealing_date) ?? isoDate(d.effective_dealing_date),
      type: d.type,
      amount: Number(d.amount),
      shares: d.shares != null ? Number(d.shares) : null,
      shareClass:
        parseShareClass(d.share_class) ??
        (d.share_class?.trim() ? d.share_class.trim() : null),
      notes: d.notes?.trim() || null,
      createdAt: d.created_at,
    }));
    return {
      investorId: row.id,
      investorCode: row.investor_code?.trim() || "",
      name: row.name,
      legalName: row.legal_name?.trim() || null,
      email: row.email,
      investorType: row.investor_type?.trim() || null,
      mailingAddress: row.mailing_address?.trim() || null,
      shareClass:
        parseShareClass(row.share_class) ??
        (row.share_class?.trim() ? row.share_class.trim() : null),
      status: row.status,
      createdAt: row.created_at,
      firstDealingDate: isoDate(row.first_dealing_date),
      lastDealingDate: isoDate(row.last_dealing_date),
      firstTradeDate: isoDate(row.first_trade_date),
      lastTradeDate: isoDate(row.last_trade_date),
      dealingCount: Number(row.dealing_count),
      units: row.units,
      grossCapital: Number(row.gross_capital),
      transactionCharges: Number(row.transaction_charges),
      netCapital: Number(row.capital),
      currentNav:
        row.current_closing_nav != null ? Number(row.current_closing_nav) : null,
      navPeriod: row.nav_period,
      dealings,
    };
  });

  return {
    fundId,
    fundName: fund.name,
    asOfDate: new Date().toISOString().slice(0, 10),
    investorCount: investors.length,
    activeCount: investors.filter((i) => i.status === "active").length,
    exitedCount: investors.filter((i) => i.status === "exited").length,
    investors,
  };
}
