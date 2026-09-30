"use client";

import { useCallback, useEffect, useState } from "react";
import { useFund } from "@/contexts/fund-context";
import { PageHeader } from "@/components/allocator/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatPeriodLong } from "@/lib/allocator/format";

type ImportRow = {
  period: string;
  net_profit: number;
  fetched_at: string;
  status: string;
};

export function ImportContent({ embedded }: { embedded?: boolean }) {
  const { fundId, selectedFund } = useFund();
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ImportRow[]>([]);

  const loadHistory = useCallback(async () => {
    if (!fundId) return;
    const res = await fetch(
      `/api/allocator/tychi/import-history?fundId=${fundId}`,
    );
    if (res.ok) setHistory(await res.json());
  }, [fundId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function fetchPl() {
    if (!fundId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/allocator/tychi/fetch-pl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundId, periodFrom, periodTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fetch failed");
      setSuccess(data.saved ?? []);
      if (data.errors?.length) {
        setError(
          data.errors.map((e: { period: string; message: string }) => `${e.period}: ${e.message}`).join("; "),
        );
      }
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!embedded ? <PageHeader title="Import from Tychi" /> : null}

      <div className={embedded ? "grid gap-6 xl:grid-cols-2" : "space-y-6"}>
      <Card className={embedded ? "" : "mb-6"}>
        <CardHeader>
          <CardTitle>Fetch P&L from Tychi GL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500">
            Period already imported will be skipped automatically.
          </p>
          {selectedFund ? (
            <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-sm">
              {selectedFund.name}
            </span>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Period from</Label>
              <Input
                type="month"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
              />
            </div>
            <div>
              <Label>Period to</Label>
              <Input
                type="month"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={fetchPl} disabled={loading || !periodFrom || !periodTo}>
            {loading ? "Fetching from Tychi GL..." : "Fetch & Save Report"}
          </Button>
          {success && success.length > 0 ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              {success.length} periods saved successfully:{" "}
              {success.map(formatPeriodLong).join(", ")}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
              <Button
                variant="secondary"
                size="sm"
                className="ml-2"
                onClick={fetchPl}
              >
                Retry
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className={embedded ? "" : "mb-6"}>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Net Profit</TableHead>
                <TableHead>Fetched on</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((row) => (
                <TableRow key={row.period + row.fetched_at}>
                  <TableCell>{formatPeriodLong(row.period)}</TableCell>
                  <TableCell>{formatCurrency(row.net_profit)}</TableCell>
                  <TableCell>{formatDate(row.fetched_at)}</TableCell>
                  <TableCell>
                    <Badge variant="green">Saved</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      </div>

      <p className="text-sm text-gray-500">
        Tychi GL reports are dynamic. Importing saves a snapshot to the database
        for allocation use.
      </p>
    </>
  );
}

export default function ImportPage() {
  return <ImportContent />;
}
