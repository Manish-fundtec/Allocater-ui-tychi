"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFund } from "@/contexts/fund-context";
import { PageHeader } from "@/components/allocator/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  formatNumber,
  formatPeriodLong,
} from "@/lib/allocator/format";
import {
  AllocationBreakdownView,
  type InvestorAllocationBreakdown,
} from "@/components/allocator/allocation-breakdown-view";

type InvestorRow = {
  id: string;
  name: string;
  units: number;
  capital: number;
  gross_capital?: number;
  transaction_charges?: number;
  close_nav: number | null;
};

type FeeConfig = {
  mgmtFeePct: number;
  perfFeePct: number;
  hurdleRate: number;
  frequency: string;
  effectiveFrom: string;
};

type FeeReviewLine = {
  investor_id: string;
  investor_name: string;
  investor_code?: string;
  units: number;
  capital: number;
  gross_capital?: number;
  net_capital?: number;
  transaction_charges?: number;
  share_pct: number;
  gross_profit: number;
  hurdle_return: number;
  profit_above_hurdle: number;
  mgmt_fee: number;
  perf_fee: number;
  net_profit: number;
  close_nav: number;
  open_nav: number;
  nav_per_share?: number | null;
};

type FeeReview = {
  period: string;
  netProfit: number;
  plNetProfit?: number;
  feeConfig: FeeConfig;
  frequencyFactor: number;
  applyInvestorFees?: boolean;
  summary: {
    totalProfit: number;
    totalMgmtFees: number;
    totalPerfFees: number;
    totalNetProfit: number;
  };
  lines: FeeReviewLine[];
  breakdowns?: Record<string, InvestorAllocationBreakdown>;
};


export function FeeReviewContent({ embedded }: { embedded?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fundId, selectedFund } = useFund();
  const urlInvestorId = searchParams.get("investorId");
  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(
    urlInvestorId,
  );
  const breakdownInvestorId = selectedInvestorId ?? urlInvestorId;
  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState(searchParams.get("period") ?? "");
  const [netProfit, setNetProfit] = useState<number | null>(null);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [review, setReview] = useState<FeeReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reviewInFlight = useRef(false);
  const reviewPromise = useRef<Promise<FeeReview | null> | null>(null);
  const autoReviewedKey = useRef<string | null>(null);
  const periodRef = useRef(period);
  periodRef.current = period;

  const loadPeriods = useCallback(async () => {
    if (!fundId) return;
    const res = await fetch(`/api/allocator/pl-reports?fundId=${fundId}`);
    if (res.ok) {
      const data = await res.json();
      const ps = data
        .filter((r: { fetched_at: string | null }) => r.fetched_at)
        .map((r: { period: string }) => r.period);
      setPeriods(ps);
      if (!period && ps[0]) setPeriod(ps[0]);
    }
  }, [fundId, period]);

  const loadInvestors = useCallback(async () => {
    if (!fundId || !period) return;
    const [navRes, plRes] = await Promise.all([
      fetch(`/api/allocator/nav/all?fundId=${fundId}&period=${period}`),
      fetch(`/api/allocator/pl-reports?fundId=${fundId}`),
    ]);

    if (plRes.ok) {
      const pl = await plRes.json();
      const row = pl.find((r: { period: string }) => r.period === period);
      setNetProfit(row?.net_profit ?? null);
    }

    if (!navRes.ok) return;
    const nav = await navRes.json();
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
  }, [fundId, period]);

  const runReview = useCallback(
    async (
      investorIds?: string[],
      options?: { force?: boolean },
    ): Promise<FeeReview | null> => {
      if (!fundId || !period) return null;
      if (reviewInFlight.current && !options?.force) {
        return reviewPromise.current ?? null;
      }
      const requestedPeriod = period;
      reviewInFlight.current = true;
      setLoading(true);
      setError("");
      const pending = (async () => {
        try {
          const res = await fetch("/api/allocator/fees/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fundId,
              period: requestedPeriod,
              ...(investorIds?.length ? { investorIds } : {}),
            }),
          });
          if (periodRef.current !== requestedPeriod) return null;
          if (res.ok) {
            const data: FeeReview = await res.json();
            setReview(data);
            return data;
          }
          const data = await res.json().catch(() => ({}));
          setError((data as { error?: string }).error ?? "Fee review failed");
          setReview(null);
          return null;
        } finally {
          if (periodRef.current === requestedPeriod) {
            setLoading(false);
            reviewInFlight.current = false;
          }
        }
      })();
      reviewPromise.current = pending;
      return pending;
    },
    [fundId, period],
  );

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    loadInvestors();
  }, [loadInvestors]);

  useEffect(() => {
    if (!fundId || !period) return;
    const key = `${fundId}:${period}`;
    if (autoReviewedKey.current === key) return;
    autoReviewedKey.current = key;
    setReview(null);
    reviewInFlight.current = false;
    void runReview(undefined, { force: true });
  }, [fundId, period, runReview]);

  function openInvestorBreakdown(investorId: string) {
    setSelectedInvestorId(investorId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "review");
    params.set("investorId", investorId);
    if (period) params.set("period", period);
    router.replace(`/allocator/allocation?${params.toString()}`);
    if (!review || review.period !== period) {
      void runReview();
    }
  }

  function closeBreakdown() {
    setSelectedInvestorId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("investorId");
    params.set("tab", "review");
    if (period) params.set("period", period);
    router.replace(`/allocator/allocation?${params.toString()}`);
  }

  const periodReview = review?.period === period ? review : null;
  const breakdown = breakdownInvestorId
    ? periodReview?.breakdowns?.[breakdownInvestorId]
    : undefined;

  const lineMap = new Map(
    periodReview?.lines.map((l) => [l.investor_id, l]) ?? [],
  );
  const tableRows = periodReview?.lines?.length
    ? periodReview.lines.map((line) => ({
        id: line.investor_id,
        name: line.investor_name,
        units: line.units,
        capital: line.net_capital ?? line.capital,
        gross_capital: line.gross_capital ?? line.capital,
        transaction_charges: line.transaction_charges ?? 0,
        navPerShare: line.nav_per_share ?? null,
        line,
      }))
    : investors.map((inv) => ({
        id: inv.id,
        name: inv.name,
        units: inv.units,
        capital: inv.capital,
        gross_capital: inv.gross_capital ?? inv.capital,
        transaction_charges: inv.transaction_charges ?? 0,
        navPerShare: inv.close_nav,
        line: lineMap.get(inv.id) ?? null,
      }));

  function money2(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    const n = Number(value);
    return `${n < 0 ? "−" : ""}₹${formatNumber(Math.abs(n), 2)}`;
  }

  const missingNav = investors.filter(
    (i) => i.close_nav == null || i.close_nav === 0,
  );

  if (breakdownInvestorId) {
    const backHref = `/allocator/allocation?tab=review${period ? `&period=${encodeURIComponent(period)}` : ""}`;
    if (breakdown && periodReview) {
      return (
        <AllocationBreakdownView
          breakdown={breakdown}
          period={period}
          feeConfig={periodReview.feeConfig}
          frequencyFactor={periodReview.frequencyFactor}
          applyInvestorFees={periodReview.applyInvestorFees}
          backHref={backHref}
        />
      );
    }
    if (error) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={closeBreakdown}
            className="mt-4 text-sm text-[#534AB7]"
          >
            ← Back to fee review
          </button>
        </div>
      );
    }
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        Loading calculation breakdown…
      </p>
    );
  }

  return (
    <>
      {!embedded ? (
        <PageHeader
          title="Fee Review"
          description="Review management, performance, and hurdle fee calculations by period"
        />
      ) : null}

      <Card className="mb-4">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm text-gray-500">Period</p>
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
            <p className="mb-1.5 text-sm text-gray-500">Fund</p>
            <p className="font-medium">{selectedFund?.name}</p>
          </div>
        </CardContent>
      </Card>

      {netProfit != null ? (
        <Card className="mb-4">
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">P&L net profit for period</p>
            <p className="text-xl font-bold">{formatCurrency(netProfit)}</p>
          </CardContent>
        </Card>
      ) : period ? (
        <p className="mb-4 text-sm text-orange-700">
          No P&L for this period —{" "}
          <Link href="/allocator/pl?tab=import" className="underline">
            Import from Tychi
          </Link>
        </p>
      ) : null}

      {missingNav.length > 0 ? (
        <p className="mb-4 text-sm text-orange-700">
          {missingNav.length} investor(s) missing close NAV —{" "}
          <Link href="/allocator/fund?tab=nav" className="underline">
            Set NAV
          </Link>{" "}
          before reviewing fees.
        </p>
      ) : null}

      {error ? (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      ) : null}

      {periodReview ? (
        <div className="mb-4 grid gap-4 sm:grid-cols-4">
          {[
            ["Fund Gross MTD P&L", periodReview.summary.totalProfit],
            ["MTD Mgmt Fees", periodReview.summary.totalMgmtFees],
            ["Perf fees", periodReview.summary.totalPerfFees],
            ["Net MTD P&L", periodReview.summary.totalNetProfit],
          ].map(([label, val]) => (
            <div key={label as string} className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-bold">{money2(val as number)}</p>
            </div>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Investors & NAV</CardTitle>
          <Button
            onClick={() => runReview(undefined, { force: true })}
            disabled={loading || !period || investors.length === 0}
          >
            {loading ? "Calculating…" : "Review All Fees"}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Investor</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Gross capital</TableHead>
                <TableHead>Txn charges</TableHead>
                <TableHead>Net capital</TableHead>
                <TableHead>NAV / unit</TableHead>
                {periodReview ? (
                  <>
                    <TableHead>Gross MTD P&L</TableHead>
                    <TableHead>MTD Mgmt Fees</TableHead>
                    <TableHead>Perf fee</TableHead>
                    <TableHead>Net MTD P&L</TableHead>
                    <TableHead>Closing NAV</TableHead>
                  </>
                ) : null}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((inv) => {
                const line = inv.line;
                return (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.name}</TableCell>
                    <TableCell>{formatNumber(inv.units, 4)}</TableCell>
                    <TableCell>{money2(inv.gross_capital)}</TableCell>
                    <TableCell>{money2(inv.transaction_charges)}</TableCell>
                    <TableCell>{money2(inv.capital)}</TableCell>
                    <TableCell>
                      {inv.navPerShare != null
                        ? formatNumber(inv.navPerShare, 2)
                        : "—"}
                    </TableCell>
                    {periodReview ? (
                      <>
                        <TableCell className="font-medium text-slate-800">
                          {line ? money2(line.gross_profit) : "—"}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {line ? money2(line.mgmt_fee) : "—"}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {line ? money2(line.perf_fee) : "—"}
                        </TableCell>
                        <TableCell className="text-green-600">
                          {line ? money2(line.net_profit) : "—"}
                        </TableCell>
                        <TableCell>
                          {line ? money2(line.open_nav) : "—"}
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={loading || !period}
                        onClick={() => openInvestorBreakdown(inv.id)}
                      >
                        View breakdown
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

export default function FeeReviewPage() {
  return <FeeReviewContent />;
}
