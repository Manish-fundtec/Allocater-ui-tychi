"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useFund } from "@/contexts/fund-context";
import { MetricCard } from "@/components/allocator/metric-card";
import {
  NewAllocationButton,
  PageHeader,
} from "@/components/allocator/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  formatDate,
  formatPeriodLong,
  formatProfit,
} from "@/lib/allocator/format";

type DashboardStats = {
  totalInvestors: number;
  lastPLPeriod: string | null;
  lastPLProfit: number | null;
  pendingPLCount: number;
  pendingPLPeriods: string[];
  unsentReportsCount: number;
};

type AllocationRun = {
  period: string;
  totalProfit: number | null;
  status: string;
  investorCount: number;
  runAt: string | null;
};

function statusBadge(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "completed") {
    return <Badge variant="green">Completed</Badge>;
  }
  if (normalized.includes("pending") || normalized === "pl_pending") {
    return <Badge variant="orange">P&L Pending</Badge>;
  }
  if (normalized === "failed") {
    return <Badge variant="red">Failed</Badge>;
  }
  return <Badge variant="gray">{status}</Badge>;
}

export default function DashboardPage() {
  const { fundId, selectedFund, loading: fundLoading, error: fundError } = useFund();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [runs, setRuns] = useState<AllocationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!fundId) return;
    setLoading(true);
    setError(null);
    try {
      const [statsRes, runsRes] = await Promise.all([
        fetch(`/api/allocator/dashboard-stats?fundId=${fundId}`),
        fetch(`/api/allocator/allocation/history?fundId=${fundId}&limit=10`),
      ]);
      if (!statsRes.ok || !runsRes.ok) {
        throw new Error("Failed to load dashboard data");
      }
      setStats(await statsRes.json());
      setRuns(await runsRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [fundId]);

  useEffect(() => {
    if (fundLoading) return;
    if (!fundId) {
      setLoading(false);
      setError(fundError ?? "No fund loaded. Check the database connection on the server.");
      return;
    }
    load();
  }, [fundId, fundLoading, fundError, load]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Fund overview, P&L status, and recent allocation activity."
        action={<NewAllocationButton />}
      />

      {error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <Button variant="secondary" size="sm" className="ml-4" onClick={load}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-1">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))
          ) : (
            <>
              <MetricCard
                label="Total Investors"
                value={stats?.totalInvestors ?? 0}
                subtitle={selectedFund?.name}
              />
              <MetricCard
                label="Last P&L Period"
                value={stats?.lastPLPeriod ?? "—"}
                subtitle={
                  stats?.lastPLProfit != null
                    ? `${formatCurrency(stats.lastPLProfit, "INR", true)} net profit`
                    : "No P&L imported yet"
                }
              />
              <MetricCard
                label="Pending P&L"
                value={stats?.pendingPLCount ?? 0}
                valueClassName={
                  (stats?.pendingPLCount ?? 0) > 0 ? "text-red-600" : undefined
                }
                subtitle={stats?.pendingPLPeriods?.join(", ") || "All caught up"}
              />
              <MetricCard
                label="Reports Unsent"
                value={stats?.unsentReportsCount ?? 0}
                valueClassName={
                  (stats?.unsentReportsCount ?? 0) > 0
                    ? "text-orange-600"
                    : undefined
                }
                subtitle="Investors waiting"
              />
            </>
          )}
        </div>

        <Card className="xl:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Recent allocation runs</CardTitle>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/allocator/allocation?tab=history">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0 pt-0">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No allocation runs yet. Import P&L to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Period</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.period}>
                    <TableCell className="font-medium">
                      {formatPeriodLong(run.period)}
                    </TableCell>
                    <TableCell>
                      {run.totalProfit != null ? (
                        <span
                          className={
                            run.totalProfit >= 0
                              ? "font-medium text-green-600"
                              : "font-medium text-red-600"
                          }
                        >
                          {formatProfit(run.totalProfit)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(run.status)}</TableCell>
                    <TableCell className="text-right text-sm text-gray-500">
                      {run.investorCount > 0
                        ? `${run.investorCount} investors · ${run.runAt ? formatDate(run.runAt) : "—"}`
                        : "Import needed"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        </Card>
      </div>
    </>
  );
}
