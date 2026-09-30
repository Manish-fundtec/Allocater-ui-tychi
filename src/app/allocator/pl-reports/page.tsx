"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useFund } from "@/contexts/fund-context";
import { DataPanel } from "@/components/allocator/data-panel";
import { PageHeader } from "@/components/allocator/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, formatProfit } from "@/lib/allocator/format";

type PLReport = {
  id: string | null;
  period: string;
  period_label: string;
  net_profit: number | null;
  fetched_at: string | null;
  allocation_status: "allocated" | "pending" | "not_fetched";
};

export function PLReportsContent({
  embedded,
  onImported,
}: {
  embedded?: boolean;
  onImported?: () => void;
}) {
  const { fundId, loading: fundLoading } = useFund();
  const [reports, setReports] = useState<PLReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [importingPeriod, setImportingPeriod] = useState<string | null>(null);
  const [importError, setImportError] = useState("");

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!fundId) return;
    if (!opts?.silent) setLoading(true);
    const res = await fetch(`/api/allocator/pl-reports?fundId=${fundId}`);
    if (res.ok) setReports(await res.json());
    if (!opts?.silent) setLoading(false);
  }, [fundId]);

  useEffect(() => {
    if (!fundLoading && fundId) load();
  }, [fundId, fundLoading, load]);

  const pendingImport = reports.filter(
    (r) => r.allocation_status === "not_fetched",
  ).length;
  const totalProfit = reports
    .filter((r) => r.net_profit != null)
    .reduce((s, r) => s + (r.net_profit ?? 0), 0);

  async function importPeriod(period: string) {
    if (!fundId) return;
    setImportingPeriod(period);
    setImportError("");
    try {
      const res = await fetch("/api/allocator/tychi/fetch-pl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId,
          periodFrom: period,
          periodTo: period,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error ?? "Import failed",
        );
      }
      const errors = (data as { errors?: { period: string; message: string }[] })
        .errors;
      if (errors?.length) {
        throw new Error(
          errors.map((e) => e.message).join("; ") || "Import failed",
        );
      }
      await load({ silent: true });
      onImported?.();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImportingPeriod(null);
    }
  }

  function statusBadge(status: PLReport["allocation_status"]) {
    if (status === "allocated") return <Badge variant="green">Allocated</Badge>;
    if (status === "pending")
      return <Badge variant="orange">Pending allocation</Badge>;
    return <Badge variant="red">Not fetched</Badge>;
  }

  return (
    <>
      {!embedded ? (
        <PageHeader
          title="P&L Reports"
          description="Track imported periods and allocation readiness."
          action={
            <Button asChild>
              <Link href="/allocator/pl?tab=import">Fetch from Tychi</Link>
            </Button>
          }
        />
      ) : null}

      {pendingImport > 0 ? (
        <p className="mb-4 text-sm text-orange-700">
          {pendingImport} periods pending import
        </p>
      ) : null}

      {importError ? (
        <p className="mb-4 text-sm text-red-600">{importError}</p>
      ) : null}

      <DataPanel>
        {loading ? (
          <Skeleton className="m-6 h-64 w-[calc(100%-3rem)]" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Period</TableHead>
                <TableHead>Net Profit/Loss</TableHead>
                <TableHead>Fetched on</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.period}>
                  <TableCell className="font-medium">{r.period_label}</TableCell>
                  <TableCell>
                    {r.net_profit != null ? (
                      <span
                        className={
                          r.net_profit >= 0 ? "text-green-600" : "text-red-600"
                        }
                      >
                        {formatProfit(r.net_profit)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {r.fetched_at ? formatDate(r.fetched_at) : "Not fetched"}
                  </TableCell>
                  <TableCell>{statusBadge(r.allocation_status)}</TableCell>
                  <TableCell>
                    {r.allocation_status === "allocated" ? (
                      <Button variant="secondary" size="sm" asChild>
                        <Link
                          href={`/allocator/allocation?tab=history&period=${r.period}`}
                        >
                          View
                        </Link>
                      </Button>
                    ) : r.allocation_status === "pending" ? (
                      <Button size="sm" asChild>
                        <Link
                          href={`/allocator/allocation?tab=run&period=${r.period}`}
                        >
                          Run allocation
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={importingPeriod != null}
                        onClick={() => void importPeriod(r.period)}
                      >
                        {importingPeriod === r.period
                          ? "Importing…"
                          : "Import"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-gray-50 font-medium">
                <TableCell colSpan={1}>Total (fetched)</TableCell>
                <TableCell colSpan={4}>
                  {formatCurrency(totalProfit)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </DataPanel>
    </>
  );
}

export default function PLReportsPage() {
  return <PLReportsContent />;
}
