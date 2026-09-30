import {
  formatCurrency,
  formatNumber,
  formatPeriodLong,
} from "@/lib/allocator/format";
import type {
  CalcStep,
  InvestorAllocationBreakdown,
} from "@/components/allocator/allocation-breakdown-view";

type FeeConfig = {
  mgmtFeePct: number;
  perfFeePct: number;
  hurdleRate: number;
  frequency: string;
  effectiveFrom: string;
};

const DEFAULT_FEE: FeeConfig = {
  mgmtFeePct: 0,
  perfFeePct: 0,
  hurdleRate: 0,
  frequency: "monthly",
  effectiveFrom: "—",
};

export type BreakdownExportInput = {
  breakdown: InvestorAllocationBreakdown;
  period: string;
  feeConfig: FeeConfig | null;
  frequencyFactor: number;
};

type ExportRow = {
  section: string;
  label: string;
  formula: string;
  value: string;
  rawValue: number | string;
};

function formatStepValue(step: CalcStep): string {
  switch (step.format) {
    case "percent":
      return `${step.value.toFixed(2)}%`;
    case "units":
      return formatNumber(step.value, 4);
    case "nav":
      return step.value > 0 ? formatNumber(step.value) : "—";
    case "yesno":
      return step.value > 0 ? "Y" : "N";
    case "currency":
    default:
      return formatCurrency(step.value);
  }
}

function pushSteps(rows: ExportRow[], section: string, steps: CalcStep[]) {
  for (const step of steps) {
    rows.push({
      section,
      label: step.label,
      formula: step.formula,
      value: formatStepValue(step),
      rawValue: step.value,
    });
  }
}

function pushRow(
  rows: ExportRow[],
  section: string,
  label: string,
  formula: string,
  value: string,
  rawValue: number | string = value,
) {
  rows.push({ section, label, formula, value, rawValue });
}

export function buildBreakdownExportRows(input: BreakdownExportInput): {
  meta: { label: string; value: string }[];
  rows: ExportRow[];
} {
  const { breakdown, period, frequencyFactor } = input;
  const feeConfig = input.feeConfig ?? DEFAULT_FEE;
  const factorPct = (frequencyFactor * 100).toFixed(2);
  const periodLabel = formatPeriodLong(period);

  const meta = [
    { label: "Investor", value: breakdown.investorName },
    { label: "Period", value: periodLabel },
    { label: "Net profit after fees", value: formatCurrency(breakdown.summary.netProfit) },
    { label: "Fund profit", value: formatCurrency(breakdown.fund.netProfitBeforeFees) },
    { label: "Investor share (gross)", value: formatCurrency(breakdown.profitAllocation.investorProfitShare) },
    { label: "Management fee", value: formatCurrency(breakdown.managementFee.fee) },
    { label: "Performance fee", value: formatCurrency(breakdown.performanceFee.fee) },
    {
      label: "Fee structure",
      value: `Mgmt ${feeConfig.mgmtFeePct}% · Perf ${feeConfig.perfFeePct}% · Hurdle ${feeConfig.hurdleRate}% · ${feeConfig.frequency} (${factorPct}% annual) · from ${feeConfig.effectiveFrom}`,
    },
  ];

  const rows: ExportRow[] = [];

  pushSteps(rows, "1. Profit allocation", breakdown.profitAllocation.steps);
  pushRow(
    rows,
    "1. Profit allocation",
    "Gross profit (P&L share)",
    "Investor share of fund profit",
    formatCurrency(breakdown.profitAllocation.investorProfitShare),
    breakdown.profitAllocation.investorProfitShare,
  );

  pushSteps(rows, "2. Management fee", breakdown.managementFee.steps);
  pushRow(
    rows,
    "2. Management fee",
    "Profit after management fee",
    `${formatCurrency(breakdown.profitAllocation.investorProfitShare)} − ${formatCurrency(breakdown.managementFee.fee)}`,
    formatCurrency(breakdown.managementFee.profitAfterMgmtFee),
    breakdown.managementFee.profitAfterMgmtFee,
  );
  pushRow(
    rows,
    "2. Management fee",
    "GAV after management fee",
    `${formatCurrency(breakdown.managementFee.gav)} − ${formatCurrency(breakdown.managementFee.fee)}`,
    formatCurrency(breakdown.managementFee.gavAfterMgmtFee),
    breakdown.managementFee.gavAfterMgmtFee,
  );

  pushSteps(rows, "3. Performance fee", breakdown.performanceFee.steps);
  pushRow(
    rows,
    "3. Performance fee",
    "Crossed high watermark",
    breakdown.performanceFee.eligible === "Y" ? "Profit above hurdle > 0" : "Profit above hurdle = 0",
    breakdown.performanceFee.eligible,
    breakdown.performanceFee.eligible,
  );

  pushRow(
    rows,
    "Net profit & closing NAV",
    "Net profit",
    "Gross − Mgmt − Perf",
    formatCurrency(breakdown.summary.netProfit),
    breakdown.summary.netProfit,
  );
  pushRow(
    rows,
    "Net profit & closing NAV",
    "Open NAV (period end)",
    `${formatCurrency(breakdown.investor.openingNavTotal)} + ${formatCurrency(breakdown.summary.netProfit)}`,
    formatCurrency(breakdown.summary.closingNavTotal),
    breakdown.summary.closingNavTotal,
  );
  if (breakdown.summary.closingNavPerShare != null) {
    pushRow(
      rows,
      "Net profit & closing NAV",
      "NAV per share (period end)",
      `${formatCurrency(breakdown.summary.closingNavTotal)} ÷ ${formatNumber(breakdown.investor.units, 4)} units`,
      formatNumber(breakdown.summary.closingNavPerShare),
      breakdown.summary.closingNavPerShare,
    );
  }

  return { meta, rows };
}

function safeFilename(name: string): string {
  return name.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);
}

function exportBasename(input: BreakdownExportInput): string {
  return `breakdown-${safeFilename(input.breakdown.investorName)}-${input.period}`;
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBreakdownCsv(input: BreakdownExportInput) {
  const { meta, rows } = buildBreakdownExportRows(input);
  const lines: string[] = [];

  for (const m of meta) {
    lines.push([escapeCsvCell(m.label), escapeCsvCell(m.value)].join(","));
  }
  lines.push("");
  lines.push(["Section", "Label", "Formula", "Value"].map(escapeCsvCell).join(","));
  for (const r of rows) {
    lines.push(
      [r.section, r.label, r.formula, r.value].map(escapeCsvCell).join(","),
    );
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${exportBasename(input)}.csv`);
}

export async function downloadBreakdownXlsx(input: BreakdownExportInput) {
  const XLSX = await import("xlsx");
  const { meta, rows } = buildBreakdownExportRows(input);

  const sheetData: (string | number)[][] = [
    ["Profit allocation breakdown"],
    ["Investor", input.breakdown.investorName],
    ["Period", formatPeriodLong(input.period)],
    [],
    ...meta.map((m) => [m.label, m.value]),
    [],
    ["Section", "Label", "Formula", "Value", "Raw value"],
    ...rows.map((r) => [r.section, r.label, r.formula, r.value, r.rawValue]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = [{ wch: 28 }, { wch: 36 }, { wch: 48 }, { wch: 18 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Breakdown");
  XLSX.writeFile(wb, `${exportBasename(input)}.xlsx`);
}

export async function downloadBreakdownPdf(input: BreakdownExportInput) {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;

  const { meta, rows } = buildBreakdownExportRows(input);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const title = "Profit allocation breakdown";
  const subtitle = `${input.breakdown.investorName} · ${formatPeriodLong(input.period)}`;

  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitle, 14, 22);
  doc.setTextColor(0);

  let y = 28;
  doc.setFontSize(9);
  for (const m of meta) {
    doc.text(`${m.label}: ${m.value}`, 14, y, { maxWidth: 182 });
    y += 5;
  }

  autoTable(doc, {
    startY: y + 4,
    head: [["Section", "Label", "Formula", "Value"]],
    body: rows.map((r) => [r.section, r.label, r.formula, r.value]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [83, 74, 183] },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 38 },
      2: { cellWidth: 78 },
      3: { cellWidth: 28 },
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${exportBasename(input)}.pdf`);
}
