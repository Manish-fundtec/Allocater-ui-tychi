import type { jsPDF } from "jspdf";
import { STATEMENT_BLUE_RGB } from "@/components/allocator/fundtec-logo";

type AutoTable = (doc: jsPDF, options: Record<string, unknown>) => void;

export type InvestorStatement = {
  investorId: string;
  investorName: string;
  investorCode: string;
  shareClass: string;
  account: {
    openingMtd: number;
    openingYtd: number;
    subscriptionMtd: number;
    subscriptionYtd: number;
    redemptionMtd: number;
    redemptionYtd: number;
    netPnlMtd: number;
    netPnlYtd: number;
    closing: number;
    rateOfReturnMtd: number | null;
    rateOfReturnYtd: number | null;
    absoluteReturnYtd: number | null;
  };
  shares: {
    opening: number;
    subscription: number;
    redemption: number;
    closing: number;
  };
  nav: {
    availableShares: number;
    navPerShare: number | null;
    totalNav: number;
  };
};

export type InvestorStatementsReport = {
  fundId: string;
  fundName: string;
  currency: string;
  period: string;
  periodFrom: string;
  periodTo: string;
  investors: {
    investorId: string;
    investorName: string;
    investorCode: string;
  }[];
  statement: InvestorStatement | null;
};

function ordinalSuffix(day: number): string {
  if (day % 10 === 1 && day !== 11) return "st";
  if (day % 10 === 2 && day !== 12) return "nd";
  if (day % 10 === 3 && day !== 13) return "rd";
  return "th";
}

export function formatOrdinalDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "long" });
  return `${String(day).padStart(2, "0")}${ordinalSuffix(day)} ${month} ${date.getFullYear()}`;
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `(${abs})` : abs;
}

export function formatShares(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

export function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `(${abs}%)` : `${abs}%`;
}

export function isNeg(n: number | null | undefined): boolean {
  return n != null && Number.isFinite(n) && n < 0;
}

function safeFilePart(value: string): string {
  return value.replace(/[^\w-]+/g, "_").slice(0, 40);
}

function drawLogo(doc: jsPDF, x: number, y: number, size: number) {
  const r = size / 2;
  const cx = x + r;
  const cy = y + r;
  doc.setFillColor(...STATEMENT_BLUE_RGB);
  doc.circle(cx, cy, r, "F");
  doc.setFillColor(255, 255, 255);
  const barW = size * 0.1;
  const gap = size * 0.055;
  const startX = cx - (4 * barW + 3 * gap) / 2;
  const heights = [0.28, 0.42, 0.55, 0.68];
  heights.forEach((h, i) => {
    const bh = size * h;
    const bx = startX + i * (barW + gap);
    const by = cy + size * 0.28 - bh;
    doc.roundedRect(bx, by, barW, bh, 0.4, 0.4, "F");
  });
}

const DISCLAIMER =
  "This statement has been prepared by Fundtec Services LLP (\"Fundtec\") for informational purposes only. It is unaudited and may be subject to revision. It does not constitute an offer, solicitation, or tax, legal or investment advice. Investors remain solely responsible for their own tax liabilities. Past performance is not indicative of future results.";

function drawStatementPage(
  doc: jsPDF,
  autoTable: AutoTable,
  report: InvestorStatementsReport,
  statement: InvestorStatement,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 18;
  const right = pageW - 18;
  const currency = report.currency || "USD";
  const fundName = report.fundName.toUpperCase();

  drawLogo(doc, right - 16, 10, 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...STATEMENT_BLUE_RGB);
  const titleLines = doc.splitTextToSize(fundName, pageW - 56);
  doc.text(titleLines, pageW / 2, 18, { align: "center" });

  const titleBottom = 18 + (titleLines.length - 1) * 6;
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Investor Statement", pageW / 2, titleBottom + 8, {
    align: "center",
  });

  let y = titleBottom + 18;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Investor Name:", left, y);
  doc.setFont("helvetica", "normal");
  doc.text(statement.investorName, left + 38, y);
  doc.setFont("helvetica", "bold");
  doc.text("Period From:", 118, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatOrdinalDate(report.periodFrom), 148, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Investor ID:", left, y);
  doc.setFont("helvetica", "normal");
  doc.text(statement.investorCode, left + 38, y);
  doc.setFont("helvetica", "bold");
  doc.text("Period To:", 118, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatOrdinalDate(report.periodTo), 148, y);

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...STATEMENT_BLUE_RGB);
  doc.text("Account Summary", left, y);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: y + 3,
    margin: { left, right: 18 },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.4,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: "bold", halign: "left" },
      1: { halign: "right" },
      2: { halign: "right" },
    },
    head: [["", `MTD (${currency})`, `YTD (${currency})`]],
    body: [
      [
        "Opening Balance",
        formatMoney(statement.account.openingMtd),
        formatMoney(statement.account.openingYtd),
      ],
      [
        "Subscription",
        formatMoney(statement.account.subscriptionMtd),
        formatMoney(statement.account.subscriptionYtd),
      ],
      [
        "Redemption",
        formatMoney(statement.account.redemptionMtd),
        formatMoney(statement.account.redemptionYtd),
      ],
      [
        "Net Profit/Loss",
        formatMoney(statement.account.netPnlMtd),
        formatMoney(statement.account.netPnlYtd),
      ],
      [
        "Closing Balance",
        formatMoney(statement.account.closing),
        formatMoney(statement.account.closing),
      ],
      [
        "Rate of Return %",
        formatPct(statement.account.rateOfReturnMtd),
        formatPct(statement.account.rateOfReturnYtd),
      ],
      [
        "*Absolute Return %",
        "",
        formatPct(statement.account.absoluteReturnYtd),
      ],
    ],
    didParseCell: (data: { section: string; row: { index: number }; cell: { styles: { fontStyle?: string } } }) => {
      if (data.section === "body" && data.row.index === 4) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const afterAccount =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 70;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(
    "*Absolute YTD Return represents a simple, non-compounded measure of performance",
    left,
    afterAccount + 6,
  );
  doc.setTextColor(0, 0, 0);

  let y2 = afterAccount + 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...STATEMENT_BLUE_RGB);
  doc.text("Shares Summary", left, y2);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: y2 + 3,
    margin: { left, right: 18 },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.4,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", fontStyle: "bold" },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    head: [["Shares Class", "Opening", "Subscription", "Redemption", "Closing"]],
    body: [
      [
        statement.shareClass,
        formatShares(statement.shares.opening),
        formatShares(statement.shares.subscription),
        formatShares(statement.shares.redemption),
        formatShares(statement.shares.closing),
      ],
    ],
  });

  const afterShares =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y2 + 24;

  let y3 = afterShares + 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...STATEMENT_BLUE_RGB);
  doc.text("Closing NAV Summary", left, y3);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: y3 + 3,
    margin: { left, right: 18 },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.4,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "right" },
      1: { halign: "right" },
      2: { halign: "right" },
    },
    head: [["Available Shares", `NAV/Share (${currency})`, "Total NAV"]],
    body: [
      [
        formatShares(statement.nav.availableShares),
        formatMoney(statement.nav.navPerShare),
        formatMoney(statement.nav.totalNav),
      ],
    ],
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(70);
  const disc = doc.splitTextToSize(DISCLAIMER, right - left);
  doc.text(disc, left, pageH - 28);
  doc.setDrawColor(170);
  doc.setLineWidth(0.3);
  doc.line(left, pageH - 16, right, pageH - 16);
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(
    "For further information on Fundtec, please visit our website at ",
    pageW / 2 - 48,
    pageH - 11,
  );
  doc.setTextColor(...STATEMENT_BLUE_RGB);
  doc.textWithLink("www.fundtec.in", pageW / 2 + 42, pageH - 11, {
    url: "https://www.fundtec.in",
  });
}

async function loadPdf() {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return {
    jsPDF,
    autoTable: autoTableModule.default as AutoTable,
  };
}

export async function downloadInvestorStatementPdf(
  report: InvestorStatementsReport,
  statement: InvestorStatement,
) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawStatementPage(doc, autoTable, report, statement);
  doc.save(
    `${safeFilePart(report.fundName)}_${safeFilePart(statement.investorCode)}_Investor_Statement_${report.period}.pdf`,
  );
}
