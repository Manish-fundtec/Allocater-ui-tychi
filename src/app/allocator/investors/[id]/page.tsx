"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useFund } from "@/contexts/fund-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  formatNumber,
  formatPeriodLong,
  getInitials,
} from "@/lib/allocator/format";

type InvestorDetail = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  units: number;
  capital: number;
  gross_capital?: number;
  transaction_charges?: number;
  status: string;
  created_at: string;
  fund_name: string;
};

type NavRow = {
  period: string;
  close_nav: number;
  open_nav: number;
  nav_source: string;
};

type AllocRow = {
  period: string;
  gross_profit: number;
  mgmt_fee: number;
  perf_fee: number;
  net_profit: number;
  open_nav: number;
};

export default function InvestorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { fundId } = useFund();
  const [investor, setInvestor] = useState<InvestorDetail | null>(null);
  const [navHistory, setNavHistory] = useState<NavRow[]>([]);
  const [allocHistory, setAllocHistory] = useState<AllocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const load = useCallback(async () => {
    if (!id || !fundId) return;
    setLoading(true);
    const [invRes, navRes, allocRes] = await Promise.all([
      fetch(`/api/allocator/investors/${id}`),
      fetch(`/api/allocator/nav/history?investorId=${id}&fundId=${fundId}`),
      fetch(`/api/allocator/allocation/investor-history?investorId=${id}`),
    ]);
    if (invRes.ok) {
      const inv = await invRes.json();
      setInvestor(inv);
      setEmail(inv.email);
      setPhone(inv.phone ?? "");
    }
    if (navRes.ok) setNavHistory(await navRes.json());
    if (allocRes.ok) setAllocHistory(await allocRes.json());
    setLoading(false);
  }, [id, fundId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!id) return;
    const res = await fetch(`/api/allocator/investors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone }),
    });
    if (res.ok) {
      setEditing(false);
      load();
    }
  }

  if (loading || !investor) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
  }

  return (
    <>
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/allocator/fund?tab=investors" className="hover:text-gray-900">
          Investors
        </Link>
        <span className="mx-2">›</span>
        <span className="text-gray-900">{investor.name}</span>
      </nav>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-start gap-6 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#534AB7] text-lg font-semibold text-white">
            {getInitials(investor.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold">{investor.name}</h1>
              <Badge variant={investor.status === "active" ? "green" : "gray"}>
                {investor.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">{investor.fund_name}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {editing ? (
                <>
                  <Input
                    className="max-w-xs"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Input
                    className="max-w-xs"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <Button size="sm" onClick={save}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                    <a href={`mailto:${investor.email}`}>{investor.email}</a>
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                    {investor.phone ?? "No phone"}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                    {formatNumber(investor.units, 4)} units
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                    Gross {formatCurrency(investor.gross_capital ?? investor.capital)}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                    Charges {formatCurrency(investor.transaction_charges ?? 0)}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                    Net {formatCurrency(investor.capital)}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>NAV History</CardTitle>
        </CardHeader>
        <CardContent>
          {navHistory.length === 0 ? (
            <p className="text-sm text-gray-500">No NAV records yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Close NAV</TableHead>
                  <TableHead>Open NAV</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {navHistory.map((row) => {
                  const change = row.open_nav - row.close_nav;
                  return (
                    <TableRow key={row.period}>
                      <TableCell>{formatPeriodLong(row.period)}</TableCell>
                      <TableCell>{formatNumber(row.close_nav)}</TableCell>
                      <TableCell>{formatNumber(row.open_nav)}</TableCell>
                      <TableCell
                        className={
                          change >= 0 ? "text-green-600" : "text-red-600"
                        }
                      >
                        {change >= 0 ? "+" : ""}
                        {formatNumber(change)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.nav_source === "auto" ? "green" : "orange"
                          }
                        >
                          {row.nav_source === "auto" ? "Auto" : "Manual"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allocation History</CardTitle>
        </CardHeader>
        <CardContent>
          {allocHistory.length === 0 ? (
            <p className="text-sm text-gray-500">No allocations yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Gross Profit</TableHead>
                  <TableHead>Mgmt Fee</TableHead>
                  <TableHead>Perf Fee</TableHead>
                  <TableHead>Net Profit</TableHead>
                  <TableHead>Open NAV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocHistory.map((row) => (
                  <TableRow key={row.period}>
                    <TableCell>{formatPeriodLong(row.period)}</TableCell>
                    <TableCell>{formatCurrency(row.gross_profit)}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatCurrency(row.mgmt_fee)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatCurrency(row.perf_fee)}
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {formatCurrency(row.net_profit)}
                    </TableCell>
                    <TableCell>{formatNumber(row.open_nav)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
