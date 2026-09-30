"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatNumber,
  formatPeriodLong,
} from "@/lib/allocator/format";
import {
  downloadBreakdownCsv,
  downloadBreakdownPdf,
  downloadBreakdownXlsx,
} from "@/lib/allocator/exportBreakdown";

export type CalcStep = {
  label: string;
  formula: string;
  value: number;
  format?: "currency" | "percent" | "units" | "nav" | "yesno";
};

export type InvestorAllocationBreakdown = {
  investorId: string;
  investorName: string;
  fund: {
    totalUnits: number;
    totalCapital: number;
    netProfitBeforeFees: number;
  };
  investor: {
    units: number;
    sharePct: number;
    netCapital: number;
    grossCapital: number;
    transactionCharges: number;
    openingNavTotal: number;
    openingNavPerShare: number | null;
    subscriptionDuringMonth: number;
    redemptionDuringMonth: number;
  };
  profitAllocation: {
    steps: CalcStep[];
    investorProfitShare: number;
  };
  managementFee: {
    steps: CalcStep[];
    fee: number;
    profitAfterMgmtFee: number;
    gav: number;
    gavAfterMgmtFee: number;
  };
  performanceFee: {
    steps: CalcStep[];
    hurdleRatePct: number;
    hurdleValue: number;
    highWatermarkPerShare: number | null;
    crossedHighWatermark: boolean;
    eligible: "Y" | "N";
    fee: number;
  };
  summary: {
    netProfit: number;
    closingNavTotal: number;
    closingNavPerShare: number | null;
  };
};

type FeeConfig = {
  mgmtFeePct: number;
  perfFeePct: number;
  hurdleRate: number;
  frequency: string;
  effectiveFrom: string;
};

const DEFAULT_FEE_CONFIG: FeeConfig = {
  mgmtFeePct: 0,
  perfFeePct: 0,
  hurdleRate: 0,
  frequency: "monthly",
  effectiveFrom: "—",
};

function formatStepValue(step: CalcStep): string {
  switch (step.format) {
    case "percent":
      return `${step.value.toFixed(4)}%`;
    case "units":
      return formatNumber(step.value, 4);
    case "nav":
      return step.value > 0 ? formatNumber(step.value, 6) : "—";
    case "yesno":
      return step.value > 0 ? "Y" : "N";
    case "currency":
    default:
      return `${step.value < 0 ? "−" : ""}₹${formatNumber(Math.abs(step.value), 2)}`;
  }
}

function CalcStepRow({ step }: { step: CalcStep }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{step.label}</p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-slate-500">
            {step.formula}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-slate-900">
          {formatStepValue(step)}
        </p>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  accent,
  steps,
  footer,
}: {
  title: string;
  subtitle: string;
  accent: "violet" | "blue" | "amber";
  steps: CalcStep[];
  footer?: React.ReactNode;
}) {
  const accentClass = {
    violet: "border-[#534AB7]/20 bg-[#EEEDFE]/30",
    blue: "border-blue-200/80 bg-blue-50/40",
    amber: "border-amber-200/80 bg-amber-50/40",
  }[accent];

  return (
    <Card className={`overflow-hidden border-2 ${accentClass}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => (
          <CalcStepRow key={step.label} step={step} />
        ))}
        {footer}
      </CardContent>
    </Card>
  );
}

export function AllocationBreakdownView({
  breakdown,
  period,
  feeConfig,
  frequencyFactor,
  applyInvestorFees: _applyInvestorFees,
  backHref,
}: {
  breakdown: InvestorAllocationBreakdown;
  period: string;
  feeConfig: FeeConfig | null;
  frequencyFactor: number;
  applyInvestorFees?: boolean;
  backHref: string;
}) {
  const factorPct = (frequencyFactor * 100).toFixed(2);
  const fees = feeConfig ?? DEFAULT_FEE_CONFIG;
  const [exporting, setExporting] = useState<string | null>(null);

  const exportInput = { breakdown, period, feeConfig: fees, frequencyFactor };

  async function handleExport(format: "csv" | "xlsx" | "pdf") {
    setExporting(format);
    try {
      if (format === "csv") downloadBreakdownCsv(exportInput);
      else if (format === "xlsx") await downloadBreakdownXlsx(exportInput);
      else await downloadBreakdownPdf(exportInput);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={backHref}
            prefetch={false}
            className="text-sm text-[#534AB7] hover:underline"
          >
            ← Back to fee review
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {breakdown.investorName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatPeriodLong(period)} · Profit allocation breakdown
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" disabled={exporting != null}>
                <Download className="mr-2 h-4 w-4" />
                {exporting ? `Exporting ${exporting.toUpperCase()}…` : "Download"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                PDF (.pdf)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-right">
            <p className="text-xs text-slate-500">Net MTD P&L</p>
            <p className="text-xl font-bold text-green-700">
              {formatStepValue({
                value: breakdown.summary.netProfit,
                label: "net",
                format: "currency",
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Fund Gross MTD P&L", breakdown.fund.netProfitBeforeFees],
          ["Gross MTD P&L", breakdown.profitAllocation.investorProfitShare],
          ["MTD Mgmt Fees", breakdown.managementFee.fee],
          ["Perf fee", breakdown.performanceFee.fee],
        ].map(([label, val]) => (
          <div
            key={label as string}
            className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-lg font-bold">
              {formatStepValue({
                value: val as number,
                label: label as string,
                format: "currency",
              })}
            </p>
          </div>
        ))}
      </div>

      <SectionCard
        title="1. Profit allocation"
        subtitle="How fund profit is split by capital share and units"
        accent="violet"
        steps={breakdown.profitAllocation.steps}
        footer={
          <div className="mt-3 rounded-lg border border-[#534AB7]/30 bg-[#EEEDFE]/60 px-4 py-3">
            <div className="flex justify-between gap-4">
              <span className="text-sm font-semibold text-[#534AB7]">
                Gross MTD P&L
              </span>
              <span className="text-sm font-bold text-[#534AB7]">
                {formatStepValue({
                  value: breakdown.profitAllocation.investorProfitShare,
                  label: "gross",
                  format: "currency",
                })}
              </span>
            </div>
          </div>
        }
      />

      <SectionCard
        title="2. Management fee"
        subtitle="GAV, subscriptions/redemptions, and management fee deduction"
        accent="blue"
        steps={breakdown.managementFee.steps}
        footer={
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-blue-300/50 bg-blue-50 px-4 py-3">
              <div className="flex justify-between gap-4">
                <span className="text-sm font-semibold text-blue-900">
                  Net MTD P&L
                </span>
                <span className="text-sm font-bold text-blue-900">
                  {formatStepValue({
                    value: breakdown.managementFee.profitAfterMgmtFee,
                    label: "netmtd",
                    format: "currency",
                  })}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-blue-700/80">
                Gross MTD P&L + MTD Mgmt Fees
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white px-4 py-3">
              <div className="flex justify-between gap-4">
                <span className="text-sm font-medium text-slate-700">
                  GAV
                </span>
                <span className="text-sm font-semibold">
                  {formatStepValue({
                    value: breakdown.managementFee.gavAfterMgmtFee,
                    label: "gav",
                    format: "currency",
                  })}
                </span>
              </div>
            </div>
          </div>
        }
      />

      <SectionCard
        title="3. Performance fee"
        subtitle="High watermark, hurdle rate, and performance fee eligibility"
        accent="amber"
        steps={breakdown.performanceFee.steps}
        footer={
          <div className="mt-3 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Crossed high watermark?{" "}
                  <span
                    className={
                      breakdown.performanceFee.eligible === "Y"
                        ? "text-green-700"
                        : "text-slate-600"
                    }
                  >
                    {breakdown.performanceFee.eligible}
                  </span>
                </p>
                <p className="mt-1 font-mono text-xs text-amber-800/80">
                  Hurdle {fees.hurdleRate}% · Perf fee {fees.perfFeePct}%
                  · {fees.frequency} ({factorPct}% of annual rate)
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-amber-800/70">Performance fee</p>
                <p className="text-lg font-bold text-amber-900">
                  {formatStepValue({
                    value: breakdown.performanceFee.fee,
                    label: "perf",
                    format: "currency",
                  })}
                </p>
              </div>
            </div>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Net profit & closing NAV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <CalcStepRow
            step={{
              label: "Net MTD P&L",
              formula: "Gross MTD P&L + MTD Mgmt Fees",
              value: breakdown.summary.netProfit,
              format: "currency",
            }}
          />
          <CalcStepRow
            step={{
              label: "Closing Net Capital Balance",
              formula: "Adjusted Opening + Net MTD P&L",
              value: breakdown.summary.closingNavTotal,
              format: "currency",
            }}
          />
          {breakdown.summary.closingNavPerShare != null ? (
            <CalcStepRow
              step={{
                label: "Closing NAV per share",
                formula: "Closing Net Capital ÷ Number of Shares",
                value: breakdown.summary.closingNavPerShare,
                format: "nav",
              }}
            />
          ) : null}
          <p className="pt-2 text-xs text-slate-400">
            Fee structure effective from {fees.effectiveFrom}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
