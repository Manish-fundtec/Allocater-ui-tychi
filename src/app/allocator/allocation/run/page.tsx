"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useFund } from "@/contexts/fund-context";
import { PageHeader } from "@/components/allocator/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatCurrency,
  formatNumber,
  formatPeriodLong,
} from "@/lib/allocator/format";

type Step = "configure" | "previewing" | "preview" | "confirming";

type InvestorRow = {
  id: string;
  name: string;
  units: number;
  capital: number;
  gross_capital?: number;
  transaction_charges?: number;
  close_nav?: number | null;
};

export function RunAllocationContent({ embedded }: { embedded?: boolean }) {
  const searchParams = useSearchParams();
  const { fundId, selectedFund } = useFund();
  const [step, setStep] = useState<Step>("configure");
  const [period, setPeriod] = useState(searchParams.get("period") ?? "");
  const [periods, setPeriods] = useState<string[]>([]);
  const [feeConfig, setFeeConfig] = useState<Record<string, unknown> | null>(null);
  const [netProfit, setNetProfit] = useState<number | null>(null);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{
    summary: Record<string, number>;
    lines: Array<Record<string, unknown>>;
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadMeta = useCallback(
    async (afterAllocation?: string) => {
      if (!fundId) return;
      const [plRes, feeRes] = await Promise.all([
        fetch(`/api/allocator/pl-reports?fundId=${fundId}`),
        fetch(`/api/allocator/fees?fundId=${fundId}`),
      ]);
      if (plRes.ok) {
        const pl = await plRes.json();
        const pending = pl
          .filter(
            (r: { allocation_status: string }) =>
              r.allocation_status === "pending",
          )
          .map((r: { period: string }) => r.period)
          .sort();

        setPeriods(pending);

        let nextPeriod = period;
        if (afterAllocation) {
          nextPeriod =
            pending.find((p: string) => p > afterAllocation) ??
            pending[0] ??
            "";
          setPeriod(nextPeriod);
        } else if (period && !pending.includes(period)) {
          nextPeriod =
            pending.find((p: string) => p > period) ?? pending[0] ?? "";
          setPeriod(nextPeriod);
        } else if (!period && pending[0]) {
          nextPeriod = pending[0];
          setPeriod(nextPeriod);
        }

        const current = pl.find(
          (r: { period: string }) => r.period === nextPeriod,
        );
        setNetProfit(current?.net_profit ?? null);
      }
      if (feeRes.ok) {
        const f = await feeRes.json();
        setFeeConfig(f.current);
      }
    },
    [fundId, period],
  );

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (!fundId || !period) return;
    fetch(`/api/allocator/nav/all?fundId=${fundId}&period=${period}`).then(
      async (res) => {
        if (!res.ok) return;
        const nav = await res.json();
        setInvestors(
          nav.map(
            (n: {
              investor_id: string;
              investor_name: string;
              units: number;
              capital: number;
              gross_capital?: number;
              transaction_charges?: number;
              close_nav: number | null;
            }) => ({
              id: n.investor_id,
              name: n.investor_name,
              units: n.units,
              capital: n.capital,
              gross_capital: n.gross_capital,
              transaction_charges: n.transaction_charges,
              close_nav: n.close_nav,
            }),
          ),
        );
        setSelected(new Set(nav.map((n: { investor_id: string }) => n.investor_id)));
      },
    );
  }, [fundId, period]);

  const allSelected = selected.size === investors.length;

  async function runPreview() {
    if (!fundId || !period) return;
    setStep("previewing");
    const res = await fetch("/api/allocator/allocation/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fundId,
        period,
        investorIds: Array.from(selected),
      }),
    });
    if (res.ok) {
      setPreview(await res.json());
      setStep("preview");
    } else {
      setStep("configure");
      alert("Preview failed");
    }
  }

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  async function confirmRun() {
    if (!fundId || !period) return;
    setStep("confirming");
    const res = await fetch("/api/allocator/allocation/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fundId,
        period,
        investorIds: Array.from(selected),
      }),
    });
    if (res.ok) {
      const allocatedPeriod = period;
      setSuccessMessage(
        `${formatPeriodLong(allocatedPeriod)} has been successfully allocated.`,
      );
      setPreview(null);
      setStep("configure");
      await loadMeta(allocatedPeriod);
    } else {
      setStep("preview");
      alert("Allocation failed");
    }
  }

  const successToast = successMessage ? (
    <div
      role="status"
      className="fixed left-1/2 top-6 z-50 flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-xl border border-green-200 bg-white px-4 py-3 shadow-lg"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-green-800">{successMessage}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Investor NAV and allocation records have been saved.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setSuccessMessage(null)}
        className="shrink-0 text-slate-400 hover:text-slate-600"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  ) : null;

  if (step === "preview" || step === "confirming") {
    return (
      <>
        {successToast}
        {!embedded ? <PageHeader title="Allocation Preview" /> : (
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Allocation Preview</h2>
        )}
        <Button
          variant="secondary"
          className="mb-4"
          onClick={() => setStep("configure")}
        >
          Back
        </Button>
        {preview ? (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-4">
              {[
                ["Total profit", preview.summary.totalProfit],
                ["Mgmt fees", preview.summary.totalMgmtFees],
                ["Perf fees", preview.summary.totalPerfFees],
                ["Net profit", preview.summary.totalNetProfit],
              ].map(([label, val]) => (
                <div key={label as string} className="rounded-lg bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(val as number)}
                  </p>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-lg border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investor</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Share %</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Mgmt</TableHead>
                    <TableHead>Perf</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>New Open NAV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.lines.map((line) => (
                    <TableRow key={line.investor_id as string}>
                      <TableCell>{line.investor_name as string}</TableCell>
                      <TableCell>{formatNumber(line.units as number, 0)}</TableCell>
                      <TableCell>{(line.share_pct as number).toFixed(2)}%</TableCell>
                      <TableCell>{formatCurrency(line.gross_profit as number)}</TableCell>
                      <TableCell className="text-gray-500">
                        {formatCurrency(line.mgmt_fee as number)}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatCurrency(line.perf_fee as number)}
                      </TableCell>
                      <TableCell className="text-green-600">
                        {formatCurrency(line.net_profit as number)}
                      </TableCell>
                      <TableCell>{formatNumber(line.open_nav as number)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-6 flex gap-3">
              <Button onClick={confirmRun} disabled={step === "confirming"}>
                Confirm & Run Allocation
              </Button>
              <Button variant="secondary" onClick={() => setStep("configure")}>
                Cancel
              </Button>
            </div>
          </>
        ) : null}
      </>
    );
  }

  const missingNav = investors.filter(
    (i) => selected.has(i.id) && (i.close_nav == null || i.close_nav === 0),
  );

  return (
    <>
      {successToast}
      {!embedded ? <PageHeader title="Run Allocation" /> : null}

      <Card className="mb-4">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Period</p>
            <Select value={period} onValueChange={setPeriod}>
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
            <p className="text-sm text-gray-500">Fund</p>
            <p className="font-medium">{selectedFund?.name}</p>
          </div>
        </CardContent>
      </Card>

      {feeConfig ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Fee config</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            Mgmt {(feeConfig.mgmtFeePct as number) ?? 0}% · Perf{" "}
            {(feeConfig.perfFeePct as number) ?? 0}% · Hurdle{" "}
            {(feeConfig.hurdleRate as number) ?? 0}% ·{" "}
            {String(feeConfig.frequency)}{" "}
            <Link href="/allocator/allocation?tab=structure" className="text-[#534AB7]">
              Change
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-4">
        <CardContent className="p-6">
          <p className="text-sm text-gray-500">P&L net profit</p>
          {netProfit != null ? (
            <p className="text-xl font-bold">{formatCurrency(netProfit)}</p>
          ) : (
            <p className="text-orange-600">
              Missing P&L —{" "}
              <Link href="/allocator/pl?tab=import" className="underline">
                Import
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      {missingNav.length > 0 ? (
        <p className="mb-4 text-sm text-orange-700">
          Warning: {missingNav.length} investor(s) missing close NAV for this
          period.
        </p>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Investors</CardTitle>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(c) => {
                if (c) setSelected(new Set(investors.map((i) => i.id)));
                else setSelected(new Set());
              }}
            />
            Select all
          </label>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Name</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Txn charges</TableHead>
                <TableHead>Net capital</TableHead>
                <TableHead>NAV / unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investors.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(inv.id)}
                      onCheckedChange={(c) => {
                        const next = new Set(selected);
                        if (c) next.add(inv.id);
                        else next.delete(inv.id);
                        setSelected(next);
                      }}
                    />
                  </TableCell>
                  <TableCell>{inv.name}</TableCell>
                  <TableCell>{formatNumber(inv.units, 4)}</TableCell>
                  <TableCell>{formatCurrency(inv.gross_capital ?? inv.capital)}</TableCell>
                  <TableCell>{formatCurrency(inv.transaction_charges ?? 0)}</TableCell>
                  <TableCell>{formatCurrency(inv.capital)}</TableCell>
                  <TableCell>
                    {inv.close_nav != null ? formatNumber(inv.close_nav) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Button className="mt-6" onClick={runPreview} disabled={!period || selected.size === 0}>
        Calculate & Preview
      </Button>
    </>
  );
}

export default function RunAllocationPage() {
  return <RunAllocationContent />;
}
