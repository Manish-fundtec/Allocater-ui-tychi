"use client";

import { SectionPage } from "@/components/allocator/section-page";
import { InvestorsContent } from "@/app/allocator/investors/page";
import { NavHistoryContent } from "@/app/allocator/nav/page";
import { useEffect, useState } from "react";
import { useFund } from "@/contexts/fund-context";

export default function FundPage() {
  const { fundId } = useFund();
  const [investorCount, setInvestorCount] = useState(0);

  useEffect(() => {
    if (!fundId) return;
    fetch(`/api/allocator/badges?fundId=${fundId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setInvestorCount(data.investorCount ?? 0);
      })
      .catch(() => {});
  }, [fundId]);

  return (
    <SectionPage
      title="Investor"
      description="Investor registry and NAV history for the selected fund."
      defaultTab="investors"
      tabs={[
        {
          id: "investors",
          label: "Investors",
          badge: investorCount,
          badgeVariant: "blue",
        },
        { id: "nav", label: "NAV History" },
      ]}
    >
      {(tab) =>
        tab === "investors" ? (
          <InvestorsContent embedded />
        ) : (
          <NavHistoryContent embedded />
        )
      }
    </SectionPage>
  );
}
