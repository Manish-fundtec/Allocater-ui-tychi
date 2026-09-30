"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { useFund } from "@/contexts/fund-context";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPeriodLong } from "@/lib/allocator/format";
import {
  allocationGroups,
  downloadInvestorAllocationXlsx,
  formatReportCell,
  isNegativeReportValue,
  type AllocationColumn,
  type InvestorAllocationReport,
  type InvestorAllocationRow,
} from "@/lib/allocator/investorAllocationColumns";
import { cn } from "@/lib/utils";

export function InvestorAllocationReportContent() {
  const { fundId, selectedFund } = useFund();
  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState("");
  const [report, setReport] = useState<InvestorAllocationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const loadPeriods = useCallback(async () => {
    if (!fundId) return;
    const res = await fetch(`/api/allocator/pl-reports?fundId=${fundId}`);
    if (!res.ok) return;
    const data = await res.json();
    const ps = (data as { fetched_at: string | null; period: string }[])
      .filter((r) => r.fetched_at)
      .map((r) => r.period)
      .sort((a, b) => b.localeCompare(a));
    setPeriods(ps);
    setPeriod((current) => current || ps[0] || "");
  }, [fundId]);

  useEffect(() => {
    setReport(null);
    setPeriod("");
    setError("");
    void loadPeriods();
  }, [loadPeriods]);

  const loadReport = useCallback(async () => {
    if (!fundId || !period) return;
    setLoading(true);
    setError("");
    const res = await fetch(
      `/api/allocator/reports/investor-allocation?fundId=${fundId}&period=${period}`,
    );
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setReport(null);
      setError(
        (data as { error?: string }).error ??
          "Could not build investor allocation report",
      );
      return;
    }
    setReport(await res.json());
  }, [fundId, period]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const groups = useMemo(
    () =>
      allocationGroups({
        hurdleRate: report?.hurdleRate ?? 5,
        perfFeePct: report?.perfFeePct ?? 20,
        perfTierPct: report?.perfTierPct ?? 30,
      }),
    [report?.hurdleRate, report?.perfFeePct, report?.perfTierPct],
  );

  async function onDownload() {
    if (!report) return;
    setDownloading(true);
    try {
      await downloadInvestorAllocationXlsx(report);
    } finally {
      setDownloading(false);
    }
  }

  const asOfLabel = report?.asOfDate
    ? new Date(`${report.asOfDate}T00:00:00`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : period
      ? formatPeriodLong(period)
      : "";

  const flatColumns = groups.flatMap((group, gi) =>
    group.columns.map((col, ci) => ({
      ...col,
      groupStart: ci === 0,
      sticky: gi === 0 ? ci : null,
    })),
  );

  const stickyLeft = [0, 108, 228] as const;
  const stickyWidth = [108, 120, 72] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-[200px]">
            <p className="mb-1.5 text-sm text-gray-500">Period</p>
            <Select value={period || undefined} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p} value={p}>
                    {formatPeriodLong(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1.5 text-sm text-gray-500">Fund</p>
            <p className="pt-2 font-medium text-slate-900">
              {report?.fundName ?? selectedFund?.name ?? "—"}
            </p>
          </div>
        </div>
        <Button
          onClick={() => void onDownload()}
          disabled={!report || report.allocated === false || downloading}
        >
          <Download className="h-4 w-4" />
          {downloading ? "Preparing…" : "Download Excel"}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500">Building report…</p>
      ) : null}

      {!loading && !error && report && report.allocated === false ? (
        <EmptyState message="Allocation has not been run for this period. Run allocation first to see the investor allocation report." />
      ) : null}

      {!loading && !error && report && report.allocated !== false ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              {report.fundName}
            </p>
            <p className="text-sm text-slate-700">Investor Allocation</p>
            <p className="text-xs text-slate-500">{asOfLabel}</p>
          </div>
          <div className="max-h-[calc(100vh-280px)] overflow-auto">
            <table className="min-w-max border-collapse text-[11px] leading-tight">
              <thead className="sticky top-0 z-20">
                <tr>
                  {groups.map((group, gi) => (
                    <th
                      key={group.key}
                      colSpan={group.columns.length}
                      className={cn(
                        "border border-slate-300 bg-[#d6e3f0] px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-800",
                        gi === 0 && "sticky left-0 z-30",
                      )}
                    >
                      {group.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {flatColumns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        "whitespace-nowrap border border-slate-300 bg-[#eef3f8] px-2 py-1.5 text-center font-semibold text-slate-700",
                        col.groupStart && "border-l-2 border-l-slate-400",
                        col.sticky != null && "sticky z-30 bg-[#eef3f8]",
                      )}
                      style={
                        col.sticky != null
                          ? {
                              left: stickyLeft[col.sticky],
                              minWidth: stickyWidth[col.sticky],
                            }
                          : undefined
                      }
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <ReportDataRow
                    key={row.investorId}
                    row={row}
                    columns={flatColumns}
                    stickyLeft={stickyLeft}
                    stickyWidth={stickyWidth}
                  />
                ))}
                <ReportDataRow
                  row={report.totals}
                  columns={flatColumns}
                  stickyLeft={stickyLeft}
                  stickyWidth={stickyWidth}
                  total
                />
                {report.check ? (
                  <ReportDataRow
                    row={report.check}
                    columns={flatColumns}
                    stickyLeft={stickyLeft}
                    stickyWidth={stickyWidth}
                    total
                  />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && !error && !report && !period ? (
        <EmptyState message="Import a P&L period to build the investor allocation report." />
      ) : null}
    </div>
  );
}

type FlatColumn = AllocationColumn & {
  groupStart: boolean;
  sticky: number | null;
};

function ReportDataRow({
  row,
  columns,
  stickyLeft,
  stickyWidth,
  total,
}: {
  row: InvestorAllocationRow;
  columns: FlatColumn[];
  stickyLeft: readonly number[];
  stickyWidth: readonly number[];
  total?: boolean;
}) {
  if (!row) return null;
  return (
    <tr className={cn(total && "bg-slate-50 font-semibold")}>
      {columns.map((col) => {
        const value = row[col.key];
        const negative = isNegativeReportValue(value, col.format);
        return (
          <td
            key={`${row.investorId}-${col.key}`}
            className={cn(
              "whitespace-nowrap border border-slate-200 px-2 py-1 tabular-nums",
              col.format === "text" ? "text-left" : "text-right",
              negative && "text-red-700",
              total && "border-t-2 border-t-slate-400",
              col.groupStart && "border-l-2 border-l-slate-400",
              col.sticky != null && "sticky z-10",
              col.sticky != null && (total ? "bg-slate-50" : "bg-white"),
            )}
            style={
              col.sticky != null
                ? {
                    left: stickyLeft[col.sticky],
                    minWidth: stickyWidth[col.sticky],
                  }
                : undefined
            }
          >
            {formatReportCell(value, col.format)}
          </td>
        );
      })}
    </tr>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <FileSpreadsheet className="h-5 w-5 text-slate-400" />
      </div>
      <p className="font-medium text-slate-900">No report yet</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
    </div>
  );
}
