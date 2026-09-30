"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useFund } from "@/contexts/fund-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  downloadInvestorRegisterXlsx,
  flattenRegisterLines,
  formatRegisterDate,
  formatRegisterDateTime,
  type InvestorRegisterReport,
} from "@/lib/allocator/investorRegister";
import { formatCurrency, formatNumber } from "@/lib/allocator/format";

const COLUMNS = [
  "Code",
  "Investor",
  "Legal name",
  "Email",
  "Type",
  "Address",
  "Status",
  "Created on",
  "Terms",
  "Trade date",
  "Dealing date",
  "Type",
  "Amount",
  "Shares",
  "Booked on",
  "Notes",
] as const;

export function InvestorRegisterReportContent() {
  const { fundId, selectedFund } = useFund();
  const [report, setReport] = useState<InvestorRegisterReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    if (!fundId) return;
    setLoading(true);
    setError("");
    const res = await fetch(
      `/api/allocator/reports/investor-register?fundId=${fundId}`,
    );
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setReport(null);
      setError(
        (data as { error?: string }).error ?? "Could not build investor register",
      );
      return;
    }
    setReport(await res.json());
  }, [fundId]);

  useEffect(() => {
    setReport(null);
    setError("");
    void loadReport();
  }, [loadReport]);

  const lines = useMemo(
    () => (report ? flattenRegisterLines(report) : []),
    [report],
  );

  async function onDownload() {
    if (!report) return;
    setDownloading(true);
    try {
      await downloadInvestorRegisterXlsx(report);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Fund</p>
          <p className="pt-1 font-medium text-slate-900">
            {report?.fundName ?? selectedFund?.name ?? "—"}
          </p>
          {report ? (
            <p className="mt-1 text-xs text-slate-500">
              {report.investorCount} investors · {lines.length} dealing lines ·{" "}
              {report.activeCount} active
            </p>
          ) : null}
        </div>
        <Button onClick={() => void onDownload()} disabled={!report || downloading}>
          <Download className="h-4 w-4" />
          {downloading ? "Preparing…" : "Download Excel"}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-slate-500">Building investor register…</p>
      ) : null}

      {!loading && !error && report ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{report.fundName}</p>
            <p className="text-sm text-slate-700">Investor Register</p>
            <p className="text-xs text-slate-500">
              One line per dealing · As of {formatRegisterDate(report.asOfDate)}
            </p>
          </div>
          <div className="max-h-[calc(100vh-280px)] overflow-auto">
            <table className="min-w-max border-collapse text-[12px] leading-tight">
              <thead className="sticky top-0 z-20">
                <tr>
                  {COLUMNS.map((label, i) => (
                    <th
                      key={`${label}-${i}`}
                      className="border border-slate-300 bg-[#d6e3f0] px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-800 whitespace-nowrap"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const prev = lines[i - 1];
                  const grouped = prev?.investorId === line.investorId;
                  return (
                    <tr
                      key={`${line.investorId}-${line.dealingDate}-${i}`}
                      className={cn(grouped ? "bg-white" : "bg-slate-50/80")}
                    >
                      <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {line.investorCode || "—"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap font-medium text-slate-900">
                        {line.name}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap text-slate-700">
                        {line.legalName ?? "—"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap text-slate-600">
                        {line.email || "—"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">
                        {line.investorType ?? "—"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 max-w-[220px] truncate text-slate-600">
                        {line.mailingAddress ?? "—"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5">
                        <Badge variant={line.status === "active" ? "green" : "gray"}>
                          {line.status}
                        </Badge>
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap text-slate-700">
                        {formatRegisterDateTime(line.createdAt)}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-center">
                        {line.shareClass ?? "—"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">
                        {formatRegisterDate(line.tradeDate)}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap font-medium">
                        {formatRegisterDate(line.dealingDate)}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 capitalize">
                        {line.type ?? "—"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums font-medium">
                        {line.amount != null ? formatCurrency(line.amount) : "—"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                        {line.shares != null ? formatNumber(line.shares, 4) : "—"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap text-slate-600">
                        {formatRegisterDateTime(line.bookedAt)}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-slate-500">
                        {line.notes ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
