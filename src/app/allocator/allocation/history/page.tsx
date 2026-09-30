"use client";

import { useCallback, useEffect, useState } from "react";
import { useFund } from "@/contexts/fund-context";
import { PageHeader } from "@/components/allocator/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDate,
  formatPeriodLong,
  formatProfit,
} from "@/lib/allocator/format";

type Run = {
  period: string;
  totalProfit: number | null;
  status: string;
  investorCount: number;
  runAt: string | null;
};

export function AllocationHistoryContent({
  embedded,
}: {
  embedded?: boolean;
}) {
  const { fundId, loading: fundLoading } = useFund();
  const [runs, setRuns] = useState<Run[]>([]);

  const load = useCallback(async () => {
    if (!fundId) return;
    const res = await fetch(
      `/api/allocator/allocation/history?fundId=${fundId}&limit=50`,
    );
    if (res.ok) setRuns(await res.json());
  }, [fundId]);

  useEffect(() => {
    if (!fundLoading && fundId) load();
  }, [fundId, fundLoading, load]);

  return (
    <>
      {!embedded ? <PageHeader title="Allocation History" /> : null}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Total profit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Investors</TableHead>
              <TableHead>Run at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.period + (run.runAt ?? "")}>
                <TableCell className="font-medium">
                  {formatPeriodLong(run.period)}
                </TableCell>
                <TableCell>
                  {run.totalProfit != null ? (
                    <span
                      className={
                        run.totalProfit >= 0 ? "text-green-600" : "text-red-600"
                      }
                    >
                      {formatProfit(run.totalProfit)}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      run.status === "completed"
                        ? "green"
                        : run.status === "failed"
                          ? "red"
                          : "orange"
                    }
                  >
                    {run.status}
                  </Badge>
                </TableCell>
                <TableCell>{run.investorCount}</TableCell>
                <TableCell>
                  {run.runAt ? formatDate(run.runAt) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export default function AllocationHistoryPage() {
  return <AllocationHistoryContent />;
}
