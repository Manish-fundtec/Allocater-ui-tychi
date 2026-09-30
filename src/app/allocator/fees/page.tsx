"use client";

import { useCallback, useEffect, useState } from "react";
import { useFund } from "@/contexts/fund-context";
import { PageHeader } from "@/components/allocator/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate } from "@/lib/allocator/format";

type FeeConfig = {
  mgmtFeePct: number;
  perfFeePct: number;
  hurdleRate: number;
  frequency: string;
  effectiveFrom: string;
};

const defaults: FeeConfig = {
  mgmtFeePct: 2,
  perfFeePct: 20,
  hurdleRate: 8,
  frequency: "monthly",
  effectiveFrom: new Date().toISOString().slice(0, 10),
};

export function FeeStructureContent({ embedded }: { embedded?: boolean }) {
  const { fundId, selectedFund } = useFund();
  const [form, setForm] = useState<FeeConfig>(defaults);
  const [history, setHistory] = useState<FeeConfig[]>([]);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!fundId) return;
    const res = await fetch(`/api/allocator/fees?fundId=${fundId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.current) setForm(data.current);
      setHistory(data.history ?? []);
    }
  }, [fundId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!fundId) return;
    const res = await fetch("/api/allocator/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fundId, ...form, hurdleRate: form.hurdleRate }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      load();
    }
  }

  return (
    <>
      {!embedded ? <PageHeader title="Fee Structure" /> : null}

      {saved ? (
        <p className="mb-4 text-sm text-green-700">Fee structure saved.</p>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Fee Structure — {selectedFund?.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-lg gap-4">
          <div>
            <Label>Management Fee (% per year)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.mgmtFeePct}
              onChange={(e) =>
                setForm((f) => ({ ...f, mgmtFeePct: Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <Label>Performance Fee (% of profit)</Label>
            <Input
              type="number"
              step="1"
              value={form.perfFeePct}
              onChange={(e) =>
                setForm((f) => ({ ...f, perfFeePct: Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <Label>Hurdle Rate (% per year)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.hurdleRate}
              onChange={(e) =>
                setForm((f) => ({ ...f, hurdleRate: Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <Label>Fee Frequency</Label>
            <Select
              value={form.frequency}
              onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Effective From</Label>
            <Input
              type="date"
              value={form.effectiveFrom?.slice(0, 10)}
              onChange={(e) =>
                setForm((f) => ({ ...f, effectiveFrom: e.target.value }))
              }
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>Save changes</Button>
            <Button variant="secondary" onClick={() => setForm(defaults)}>
              Reset to default
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fee history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Effective from</TableHead>
                <TableHead>Mgmt %</TableHead>
                <TableHead>Perf %</TableHead>
                <TableHead>Hurdle %</TableHead>
                <TableHead>Frequency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h, i) => (
                <TableRow key={i}>
                  <TableCell>{formatDate(h.effectiveFrom)}</TableCell>
                  <TableCell>{h.mgmtFeePct}</TableCell>
                  <TableCell>{h.perfFeePct}</TableCell>
                  <TableCell>{h.hurdleRate}</TableCell>
                  <TableCell>{h.frequency}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

export default function FeesPage() {
  return <FeeStructureContent />;
}
