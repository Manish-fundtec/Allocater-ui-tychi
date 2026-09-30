"use client";

import { useCallback, useEffect, useState } from "react";
import { useFund } from "@/contexts/fund-context";
import { PageHeader } from "@/components/allocator/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type NavRow = {
  investor_id: string;
  investor_name: string;
  period: string;
  close_nav: number | null;
  open_nav: number | null;
  nav_source: string | null;
  units: number;
  gross_capital?: number;
  transaction_charges?: number;
  capital?: number;
  opening_nav?: number | null;
};

type SeedPreviewRow = {
  investor_id: string;
  investor_name: string;
  gross_capital: number;
  transaction_charges: number;
  net_capital: number;
  nav_per_share: number;
  units: number;
  opening_nav: number;
  is_new_investor: boolean;
};

export function NavHistoryContent({ embedded }: { embedded?: boolean }) {
  const { fundId, selectedFund } = useFund();
  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState("");
  const [rows, setRows] = useState<NavRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPeriod, setModalPeriod] = useState("");
  const [navPerShare, setNavPerShare] = useState("");
  const [chargeRows, setChargeRows] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<SeedPreviewRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const loadNav = useCallback(async () => {
    if (!fundId || !period) return;
    const res = await fetch(
      `/api/allocator/nav/all?fundId=${fundId}&period=${period}`,
    );
    if (res.ok) setRows(await res.json());
  }, [fundId, period]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    loadNav();
  }, [loadNav]);

  const loadPreview = useCallback(async () => {
    if (!fundId || !modalPeriod || !navPerShare) {
      setPreview([]);
      return;
    }
    const res = await fetch(
      `/api/allocator/nav/seed-preview?fundId=${fundId}&period=${modalPeriod}&navPerShare=${navPerShare}`,
    );
    if (res.ok) {
      const data = await res.json();
      const investors = data.investors as SeedPreviewRow[];
      setPreview(investors);
      setSelectedIds(new Set(investors.map((i) => i.investor_id)));
      setChargeRows(
        Object.fromEntries(
          investors.map((i) => [
            i.investor_id,
            String(i.transaction_charges ?? 0),
          ]),
        ),
      );
    }
  }, [fundId, modalPeriod, navPerShare]);

  useEffect(() => {
    if (modalOpen) loadPreview();
  }, [modalOpen, loadPreview]);

  async function seedNav() {
    if (!fundId || !modalPeriod || !navPerShare) return;
    const entries = Array.from(selectedIds).map((investorId) => ({
      investorId,
      transactionCharges: Number(chargeRows[investorId] ?? 0),
    }));
    if (!entries.length) return;

    await fetch("/api/allocator/nav/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fundId,
        period: modalPeriod,
        navPerShare: Number(navPerShare),
        entries,
      }),
    });
    setModalOpen(false);
    loadNav();
  }

  async function carryForward() {
    if (!fundId || !period || !confirm("Carry forward close NAV from previous period?")) return;
    await fetch("/api/allocator/nav/carry-forward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fundId, period }),
    });
    loadNav();
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={carryForward}>
        Carry Forward
      </Button>
      <Button
        size="sm"
        onClick={() => {
          setModalOpen(true);
          setModalPeriod(period);
        }}
      >
        Set NAV per unit
      </Button>
    </div>
  );

  return (
    <>
      {!embedded ? (
        <PageHeader title="NAV History" action={actions} />
      ) : (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      )}

      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">Units = (Gross capital − Transaction charges) ÷ NAV per unit</p>
        <p className="mt-1">
          New investors (e.g. joined in Feb) use net subscription as opening NAV — no
          prior month required. Existing investors keep carried-forward opening NAV and units.
        </p>
      </div>

      <div className="mb-4 w-48">
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

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Investor</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>NAV / unit</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Charges</TableHead>
              <TableHead>Net capital</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Opening NAV</TableHead>
              <TableHead>Closing NAV</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.investor_id}>
                <TableCell>{row.investor_name}</TableCell>
                <TableCell>{formatPeriodLong(row.period)}</TableCell>
                <TableCell>
                  {row.close_nav != null ? (
                    formatNumber(row.close_nav)
                  ) : (
                    <button
                      type="button"
                      className="text-[#534AB7] hover:underline"
                      onClick={() => {
                        setModalPeriod(row.period);
                        setModalOpen(true);
                      }}
                    >
                      — Set
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  {row.gross_capital != null
                    ? formatCurrency(row.gross_capital)
                    : "—"}
                </TableCell>
                <TableCell>
                  {row.transaction_charges != null
                    ? formatCurrency(row.transaction_charges)
                    : "—"}
                </TableCell>
                <TableCell>
                  {row.capital != null ? formatCurrency(row.capital) : "—"}
                </TableCell>
                <TableCell>{formatNumber(row.units, 4)}</TableCell>
                <TableCell>
                  {row.opening_nav != null
                    ? formatCurrency(row.opening_nav)
                    : "—"}
                </TableCell>
                <TableCell
                  className={
                    row.open_nav != null && row.close_nav != null
                      ? row.open_nav > row.close_nav
                        ? "font-semibold text-green-600"
                        : "font-semibold text-red-600"
                      : ""
                  }
                >
                  {row.open_nav != null ? formatCurrency(row.open_nav) : "—"}
                </TableCell>
                <TableCell>
                  {row.nav_source ? (
                    <Badge variant={row.nav_source === "auto" ? "green" : "orange"}>
                      {row.nav_source === "auto" ? "Auto" : "Manual"}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Set NAV per unit — {selectedFund?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Period</Label>
                <Input
                  type="month"
                  value={modalPeriod}
                  onChange={(e) => setModalPeriod(e.target.value)}
                />
              </div>
              <div>
                <Label>NAV per unit (required)</Label>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 2000"
                  value={navPerShare}
                  onChange={(e) => setNavPerShare(e.target.value)}
                />
              </div>
            </div>

            {preview.length > 0 ? (
              <div className="max-h-80 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead />
                      <TableHead>Investor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>Txn charges</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Opening NAV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row) => (
                      <TableRow key={row.investor_id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.investor_id)}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(row.investor_id);
                              else next.delete(row.investor_id);
                              setSelectedIds(next);
                            }}
                          />
                        </TableCell>
                        <TableCell>{row.investor_name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={row.is_new_investor ? "orange" : "green"}
                          >
                            {row.is_new_investor ? "New" : "Existing"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(row.gross_capital)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-8 w-28"
                            value={chargeRows[row.investor_id] ?? "0"}
                            onChange={(e) =>
                              setChargeRows((prev) => ({
                                ...prev,
                                [row.investor_id]: e.target.value,
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {formatCurrency(
                            row.gross_capital -
                              Number(chargeRows[row.investor_id] ?? 0),
                          )}
                        </TableCell>
                        <TableCell>
                          {navPerShare
                            ? formatNumber(
                                (row.gross_capital -
                                  Number(chargeRows[row.investor_id] ?? 0)) /
                                  Number(navPerShare),
                                4,
                              )
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {row.is_new_investor
                            ? formatCurrency(
                                row.gross_capital -
                                  Number(chargeRows[row.investor_id] ?? 0),
                              )
                            : formatCurrency(row.opening_nav)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : navPerShare ? (
              <p className="text-sm text-gray-500">Loading preview…</p>
            ) : (
              <p className="text-sm text-gray-500">
                Enter NAV per unit to preview units and opening NAV.
              </p>
            )}

            <Button
              onClick={seedNav}
              disabled={!navPerShare || selectedIds.size === 0}
            >
              Save selected investors
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function NavHistoryPage() {
  return <NavHistoryContent />;
}
