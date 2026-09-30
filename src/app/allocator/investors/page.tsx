"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Download, Search } from "lucide-react";
import { useFund } from "@/contexts/fund-context";
import { DataPanel } from "@/components/allocator/data-panel";
import { PageHeader } from "@/components/allocator/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  avatarColor,
  formatCurrency,
  formatDate,
  formatNumber,
  getInitials,
} from "@/lib/allocator/format";

type Investor = {
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
  current_open_nav: number | null;
};

type SortKey = "name" | "units" | "capital" | "open_nav";

const PAGE_SIZE = 20;

export function InvestorsContent({ embedded }: { embedded?: boolean }) {
  const router = useRouter();
  const { fundId, loading: fundLoading } = useFund();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tab, setTab] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    if (!fundId) return;
    setLoading(true);
    const res = await fetch(
      `/api/allocator/investors?fundId=${fundId}&status=${statusFilter}&search=${encodeURIComponent(search)}`,
    );
    if (res.ok) setInvestors(await res.json());
    setLoading(false);
  }, [fundId, statusFilter, search]);

  useEffect(() => {
    if (!fundLoading && fundId) load();
  }, [fundId, fundLoading, load]);

  const filtered = useMemo(() => {
    let list = investors;
    if (tab === "active") list = list.filter((i) => i.status === "active");
    if (tab === "exited") list = list.filter((i) => i.status === "exited");
    return [...list].sort((a, b) => {
      const av =
        sortKey === "open_nav"
          ? (a.current_open_nav ?? 0)
          : (a[sortKey] as number | string);
      const bv =
        sortKey === "open_nav"
          ? (b.current_open_nav ?? 0)
          : (b[sortKey] as number | string);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [investors, tab, sortKey, sortDir]);

  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const counts = {
    all: investors.length,
    active: investors.filter((i) => i.status === "active").length,
    exited: investors.filter((i) => i.status === "exited").length,
  };

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function exportCsv() {
    const header = [
      "Name",
      "Email",
      "Phone",
      "Units",
      "Gross",
      "Txn charges",
      "Net capital",
      "Status",
      "Entry Date",
      "Open NAV",
    ];
    const rows = filtered.map((i) => [
      i.name,
      i.email,
      i.phone ?? "",
      i.units,
      i.gross_capital ?? i.capital,
      i.transaction_charges ?? 0,
      i.capital,
      i.status,
      i.created_at,
      i.current_open_nav ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "investors.csv";
    a.click();
  }

  const SortHead = ({
    label,
    col,
  }: {
    label: string;
    col: SortKey;
  }) => (
    <TableHead>
      <button
        type="button"
        className="font-medium hover:text-gray-900"
        onClick={() => toggleSort(col)}
      >
        {label}
        {sortKey === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </TableHead>
  );

  return (
    <>
      {!embedded ? (
        <PageHeader
          title="Investors"
          description="Manage LPs, capital commitments, and opening NAV for the selected fund."
        />
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="exited">Exited</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={exportCsv}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(0); }}>
        <TabsList>
          <TabsTrigger value="all">All investors ({counts.all})</TabsTrigger>
          <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
          <TabsTrigger value="exited">Exited ({counts.exited})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <DataPanel className="mt-4">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Investor</TableHead>
                  <TableHead>Phone</TableHead>
                  <SortHead label="Units" col="units" />
                  <TableHead>Gross</TableHead>
                  <TableHead>Txn charges</TableHead>
                  <SortHead label="Net capital" col="capital" />
                  <TableHead>Entry date</TableHead>
                  <SortHead label="Open NAV" col="open_nav" />
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={10}>
                          <Skeleton className="h-10 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : pageItems.length === 0
                    ? (
                        <TableRow>
                          <TableCell colSpan={10} className="py-12 text-center text-gray-500">
                            No investors found for this fund.
                          </TableCell>
                        </TableRow>
                      )
                    : pageItems.map((inv) => (
                        <TableRow
                          key={inv.id}
                          className="cursor-pointer"
                          onClick={() =>
                            router.push(`/allocator/investors/${inv.id}`)
                          }
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                                style={{ backgroundColor: avatarColor(inv.name) }}
                              >
                                {getInitials(inv.name)}
                              </div>
                              <div>
                                <p className="font-medium">{inv.name}</p>
                                <p className="text-xs text-gray-500">{inv.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{inv.phone ?? "—"}</TableCell>
                          <TableCell>{formatNumber(inv.units, 0)}</TableCell>
                          <TableCell>{formatCurrency(inv.gross_capital ?? inv.capital)}</TableCell>
                          <TableCell>{formatCurrency(inv.transaction_charges ?? 0)}</TableCell>
                          <TableCell>{formatCurrency(inv.capital)}</TableCell>
                          <TableCell>{formatDate(inv.created_at)}</TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {inv.current_open_nav != null
                              ? formatNumber(inv.current_open_nav)
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                inv.status === "active" ? "green" : "gray"
                              }
                            >
                              {inv.status === "active" ? "Active" : "Exited"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/allocator/investors/${inv.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Eye className="h-4 w-4 text-gray-400" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
              </TableBody>
            </Table>
          </DataPanel>
          {filtered.length > PAGE_SIZE ? (
            <div className="mt-4 flex justify-between">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500">
                Page {page + 1} of {Math.ceil(filtered.length / PAGE_SIZE)}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={(page + 1) * PAGE_SIZE >= filtered.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function InvestorsPage() {
  return <InvestorsContent />;
}
