"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
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
  FundtecLogo,
  STATEMENT_BLUE,
} from "@/components/allocator/fundtec-logo";
import {
  downloadInvestorStatementPdf,
  formatMoney,
  formatOrdinalDate,
  formatPct,
  formatShares,
  isNeg,
  type InvestorStatement,
  type InvestorStatementsReport,
} from "@/lib/allocator/investorStatementPdf";
import { cn } from "@/lib/utils";

export function InvestorStatementReportContent() {
  const { fundId, selectedFund } = useFund();
  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState("");
  const [investorId, setInvestorId] = useState("");
  const [report, setReport] = useState<InvestorStatementsReport | null>(null);
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
    setInvestorId("");
    setError("");
    void loadPeriods();
  }, [loadPeriods]);

  const loadReport = useCallback(async () => {
    if (!fundId || !period) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ fundId, period });
    if (investorId) params.set("investorId", investorId);
    const res = await fetch(
      `/api/allocator/reports/investor-statements?${params}`,
    );
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setReport(null);
      setError(
        (data as { error?: string }).error ??
          "Could not build investor statement",
      );
      return;
    }
    setReport(await res.json());
  }, [fundId, period, investorId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const statement = report?.statement ?? null;

  async function downloadOne() {
    if (!report || !statement) return;
    setDownloading(true);
    try {
      await downloadInvestorStatementPdf(report, statement);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-[180px]">
            <p className="mb-1.5 text-sm text-gray-500">Period</p>
            <Select
              value={period || undefined}
              onValueChange={(value) => {
                setPeriod(value);
                setInvestorId("");
              }}
            >
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
          <div className="min-w-[220px]">
            <p className="mb-1.5 text-sm text-gray-500">Investor</p>
            <Select
              value={investorId || undefined}
              onValueChange={setInvestorId}
              disabled={!report?.investors.length}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select investor" />
              </SelectTrigger>
              <SelectContent>
                {(report?.investors ?? []).map((inv) => (
                  <SelectItem key={inv.investorId} value={inv.investorId}>
                    {inv.investorName} ({inv.investorCode})
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
          onClick={() => void downloadOne()}
          disabled={!statement || downloading}
        >
          <Download className="h-4 w-4" />
          {downloading ? "Preparing…" : "Download PDF"}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-slate-500">
          {investorId ? "Building statement…" : "Loading investors…"}
        </p>
      ) : null}

      {!loading && report && !investorId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <FileText className="h-5 w-5 text-slate-400" />
          </div>
          <p className="font-medium text-slate-900">Select an investor</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Investor Allocation is the fund-wide report. Statement is for one
            investor in this period.
          </p>
        </div>
      ) : null}

      {!loading && statement && report ? (
        <StatementPreview report={report} statement={statement} />
      ) : null}

      {!loading && !error && !report && !period ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <FileText className="h-5 w-5 text-slate-400" />
          </div>
          <p className="font-medium text-slate-900">No statement yet</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Import a P&L period, then pick one investor.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Money({ n }: { n: number | null | undefined }) {
  return (
    <span className={cn("tabular-nums", isNeg(n) && "text-red-700")}>
      {formatMoney(n)}
    </span>
  );
}

function StatementPreview({
  report,
  statement,
}: {
  report: InvestorStatementsReport;
  statement: InvestorStatement;
}) {
  const currency = report.currency || "USD";
  return (
    <div className="max-h-[calc(100vh-260px)] overflow-auto rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <div className="relative mx-auto max-w-[720px]">
        <div className="absolute right-0 top-0">
          <FundtecLogo size={56} />
        </div>
        <h2
          className="px-16 text-center text-[15px] font-bold uppercase tracking-wide"
          style={{ color: STATEMENT_BLUE }}
        >
          {report.fundName}
        </h2>
        <p className="mt-1 text-center text-sm font-bold text-slate-900">
          Investor Statement
        </p>

        <div className="mt-8 grid grid-cols-2 gap-x-8 text-[13px]">
          <p>
            <span className="font-bold">Investor Name: </span>
            {statement.investorName}
          </p>
          <p>
            <span className="font-bold">Period From: </span>
            {formatOrdinalDate(report.periodFrom)}
          </p>
          <p>
            <span className="font-bold">Investor ID: </span>
            {statement.investorCode}
          </p>
          <p>
            <span className="font-bold">Period To: </span>
            {formatOrdinalDate(report.periodTo)}
          </p>
        </div>

        <h3
          className="mt-8 text-[15px] font-bold"
          style={{ color: STATEMENT_BLUE }}
        >
          Account Summary
        </h3>
        <table className="mt-2 w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border border-black px-2 py-1.5 text-left" />
              <th className="border border-black px-2 py-1.5 font-bold">
                MTD ({currency})
              </th>
              <th className="border border-black px-2 py-1.5 font-bold">
                YTD ({currency})
              </th>
            </tr>
          </thead>
          <tbody>
            <SummaryRow
              label="Opening Balance"
              mtd={statement.account.openingMtd}
              ytd={statement.account.openingYtd}
            />
            <SummaryRow
              label="Subscription"
              mtd={statement.account.subscriptionMtd}
              ytd={statement.account.subscriptionYtd}
            />
            <SummaryRow
              label="Redemption"
              mtd={statement.account.redemptionMtd}
              ytd={statement.account.redemptionYtd}
            />
            <SummaryRow
              label="Net Profit/Loss"
              mtd={statement.account.netPnlMtd}
              ytd={statement.account.netPnlYtd}
            />
            <SummaryRow
              label="Closing Balance"
              mtd={statement.account.closing}
              ytd={statement.account.closing}
              strong
            />
            <tr>
              <td className="border border-black px-2 py-1.5 font-bold">
                Rate of Return %
              </td>
              <td className="border border-black px-2 py-1.5 text-right font-bold">
                {formatPct(statement.account.rateOfReturnMtd)}
              </td>
              <td className="border border-black px-2 py-1.5 text-right font-bold">
                {formatPct(statement.account.rateOfReturnYtd)}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 font-bold">
                *Absolute Return %
              </td>
              <td className="border border-black px-2 py-1.5" />
              <td className="border border-black px-2 py-1.5 text-right font-bold">
                {formatPct(statement.account.absoluteReturnYtd)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[11px] italic text-slate-500">
          *Absolute YTD Return represents a simple, non-compounded measure of
          performance
        </p>

        <h3
          className="mt-8 text-[15px] font-bold"
          style={{ color: STATEMENT_BLUE }}
        >
          Shares Summary
        </h3>
        <table className="mt-2 w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {[
                "Shares Class",
                "Opening",
                "Subscription",
                "Redemption",
                "Closing",
              ].map((h) => (
                <th
                  key={h}
                  className="border border-black px-2 py-1.5 font-bold"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-2 py-1.5 text-center font-bold">
                {statement.shareClass}
              </td>
              <td className="border border-black px-2 py-1.5 text-right tabular-nums">
                {formatShares(statement.shares.opening)}
              </td>
              <td className="border border-black px-2 py-1.5 text-right tabular-nums">
                {formatShares(statement.shares.subscription)}
              </td>
              <td className="border border-black px-2 py-1.5 text-right tabular-nums">
                {formatShares(statement.shares.redemption)}
              </td>
              <td className="border border-black px-2 py-1.5 text-right tabular-nums">
                {formatShares(statement.shares.closing)}
              </td>
            </tr>
          </tbody>
        </table>

        <h3
          className="mt-8 text-[15px] font-bold"
          style={{ color: STATEMENT_BLUE }}
        >
          Closing NAV Summary
        </h3>
        <table className="mt-2 w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border border-black px-2 py-1.5 font-bold">
                Available Shares
              </th>
              <th className="border border-black px-2 py-1.5 font-bold">
                NAV/Share ({currency})
              </th>
              <th className="border border-black px-2 py-1.5 font-bold">
                Total NAV
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-2 py-1.5 text-right tabular-nums">
                {formatShares(statement.nav.availableShares)}
              </td>
              <td className="border border-black px-2 py-1.5 text-right">
                <Money n={statement.nav.navPerShare} />
              </td>
              <td className="border border-black px-2 py-1.5 text-right">
                <Money n={statement.nav.totalNav} />
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-10 text-[11px] leading-relaxed text-slate-500">
          This statement has been prepared by Fundtec Services LLP
          (&quot;Fundtec&quot;) for informational purposes only. It is unaudited
          and may be subject to revision. It does not constitute an offer,
          solicitation, or tax, legal or investment advice. Investors remain
          solely responsible for their own tax liabilities. Past performance is
          not indicative of future results.
        </p>
        <div className="mt-4 border-t border-slate-300 pt-2 text-center text-[12px]">
          For further information on Fundtec, please visit our website at{" "}
          <a
            href="https://www.fundtec.in"
            className="underline"
            style={{ color: STATEMENT_BLUE }}
            target="_blank"
            rel="noreferrer"
          >
            www.fundtec.in
          </a>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  mtd,
  ytd,
  strong,
}: {
  label: string;
  mtd: number;
  ytd: number;
  strong?: boolean;
}) {
  return (
    <tr className={cn(strong && "font-bold")}>
      <td className="border border-black px-2 py-1.5 font-bold">{label}</td>
      <td className="border border-black px-2 py-1.5 text-right">
        <Money n={mtd} />
      </td>
      <td className="border border-black px-2 py-1.5 text-right">
        <Money n={ytd} />
      </td>
    </tr>
  );
}
