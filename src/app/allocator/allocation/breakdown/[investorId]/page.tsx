"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useFund } from "@/contexts/fund-context";
import {
  AllocationBreakdownView,
  type InvestorAllocationBreakdown,
} from "@/components/allocator/allocation-breakdown-view";

type FeeConfig = {
  mgmtFeePct: number;
  perfFeePct: number;
  hurdleRate: number;
  frequency: string;
  effectiveFrom: string;
};

type FeeReview = {
  period: string;
  feeConfig: FeeConfig | null;
  frequencyFactor: number;
  applyInvestorFees?: boolean;
  breakdowns: Record<string, InvestorAllocationBreakdown>;
};

export default function AllocationBreakdownPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { fundId } = useFund();
  const investorId = params.investorId as string;
  const period = searchParams.get("period") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [review, setReview] = useState<FeeReview | null>(null);

  const loadBreakdown = useCallback(async () => {
    if (!fundId || !period || !investorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/allocator/fees/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fundId,
        period,
        investorIds: [investorId],
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Failed to load breakdown");
      return;
    }
    setReview(await res.json());
  }, [fundId, period, investorId]);

  useEffect(() => {
    loadBreakdown();
  }, [loadBreakdown]);

  useEffect(() => {
    if (!period) {
      router.replace("/allocator/allocation?tab=review");
    }
  }, [period, router]);

  const backHref = `/allocator/allocation?tab=review${period ? `&period=${period}` : ""}`;
  const breakdown = review?.breakdowns?.[investorId];

  if (!period) {
    return null;
  }

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        Loading calculation breakdown…
      </p>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <a href={backHref} className="mt-4 inline-block text-sm text-[#534AB7]">
          ← Back to fee review
        </a>
      </div>
    );
  }

  if (!breakdown || !review) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-slate-500">Breakdown not found for this investor.</p>
        <a href={backHref} className="mt-4 inline-block text-sm text-[#534AB7]">
          ← Back to fee review
        </a>
      </div>
    );
  }

  return (
    <AllocationBreakdownView
      breakdown={breakdown}
      period={period}
      feeConfig={review.feeConfig}
      frequencyFactor={review.frequencyFactor}
      applyInvestorFees={review.applyInvestorFees}
      backHref={backHref}
    />
  );
}
