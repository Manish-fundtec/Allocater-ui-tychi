export type InvestorRegisterDealing = {
  tradeDate: string | null;
  dealingDate: string | null;
  type: "subscription" | "redemption" | string;
  amount: number;
  shares: number | null;
  shareClass: string | null;
  notes: string | null;
  createdAt: string | null;
};

export type InvestorRegisterRow = {
  investorId: string;
  investorCode: string;
  name: string;
  legalName: string | null;
  email: string;
  investorType: string | null;
  mailingAddress: string | null;
  shareClass: string | null;
  status: string;
  createdAt: string;
  firstDealingDate: string | null;
  lastDealingDate: string | null;
  firstTradeDate: string | null;
  lastTradeDate: string | null;
  dealingCount: number;
  units: number;
  grossCapital: number;
  transactionCharges: number;
  netCapital: number;
  currentNav: number | null;
  navPeriod: string | null;
  dealings: InvestorRegisterDealing[];
};

export type InvestorRegisterReport = {
  fundId: string;
  fundName: string;
  asOfDate: string;
  investorCount: number;
  activeCount: number;
  exitedCount: number;
  investors: InvestorRegisterRow[];
};

export type InvestorRegisterLine = {
  investorId: string;
  investorCode: string;
  name: string;
  legalName: string | null;
  email: string;
  investorType: string | null;
  mailingAddress: string | null;
  status: string;
  createdAt: string;
  shareClass: string | null;
  tradeDate: string | null;
  dealingDate: string | null;
  type: string | null;
  amount: number | null;
  shares: number | null;
  bookedAt: string | null;
  notes: string | null;
  units: number;
  grossCapital: number;
  transactionCharges: number;
  netCapital: number;
  currentNav: number | null;
  navPeriod: string | null;
};

export function flattenRegisterLines(
  report: InvestorRegisterReport,
): InvestorRegisterLine[] {
  return report.investors.flatMap((inv): InvestorRegisterLine[] => {
    const base = {
      investorId: inv.investorId,
      investorCode: inv.investorCode,
      name: inv.name,
      legalName: inv.legalName,
      email: inv.email,
      investorType: inv.investorType,
      mailingAddress: inv.mailingAddress,
      status: inv.status,
      createdAt: inv.createdAt,
      units: inv.units,
      grossCapital: inv.grossCapital,
      transactionCharges: inv.transactionCharges,
      netCapital: inv.netCapital,
      currentNav: inv.currentNav,
      navPeriod: inv.navPeriod,
    };
    if (inv.dealings.length === 0) {
      return [
        {
          ...base,
          shareClass: inv.shareClass,
          tradeDate: null,
          dealingDate: null,
          type: null,
          amount: null,
          shares: null,
          bookedAt: null,
          notes: null,
        },
      ];
    }
    return inv.dealings.map((d) => ({
      ...base,
      shareClass: d.shareClass ?? inv.shareClass,
      tradeDate: d.tradeDate,
      dealingDate: d.dealingDate,
      type: d.type,
      amount: d.amount,
      shares: d.shares,
      bookedAt: d.createdAt,
      notes: d.notes,
    }));
  });
}

export function formatRegisterDate(value: string | null | undefined): string {
  if (!value) return "—";
  const day = value.trim().slice(0, 10);
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return value;
  return new Date(year, month - 1, date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatRegisterDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatRegisterDate(value);
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function downloadInvestorRegisterXlsx(report: InvestorRegisterReport) {
  const XLSX = await import("xlsx");
  const asOf = formatRegisterDate(report.asOfDate);
  const lines = flattenRegisterLines(report);

  const header = [
    "Investor code",
    "Name",
    "Legal name",
    "Email",
    "Type",
    "Mailing address",
    "Status",
    "Created on",
    "Terms",
    "Trade date",
    "Dealing date",
    "Dealing type",
    "Dealing amount",
    "Dealing shares",
    "Booked on",
    "Notes",
    "Total units",
    "Total gross capital",
    "Txn charges",
    "Total net capital",
    "Current NAV",
    "NAV period",
  ];

  const dataRows = lines.map((line) => [
    line.investorCode,
    line.name,
    line.legalName,
    line.email,
    line.investorType,
    line.mailingAddress,
    line.status,
    formatRegisterDateTime(line.createdAt),
    line.shareClass,
    formatRegisterDate(line.tradeDate),
    formatRegisterDate(line.dealingDate),
    line.type,
    line.amount,
    line.shares,
    formatRegisterDateTime(line.bookedAt),
    line.notes,
    line.units,
    line.grossCapital,
    line.transactionCharges,
    line.netCapital,
    line.currentNav,
    line.navPeriod,
  ]);

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [report.fundName],
    ["Investor Register"],
    [`As of ${asOf}`],
    [],
    header,
    ...dataRows,
  ]);
  sheet["!cols"] = header.map((label) => ({
    wch: label.length < 16 ? 16 : Math.min(28, label.length + 2),
  }));
  XLSX.utils.book_append_sheet(wb, sheet, "Register");
  XLSX.writeFile(
    wb,
    `${report.fundName.replace(/\s+/g, "-")}-investor-register.xlsx`,
  );
}
