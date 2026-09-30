"use client";

import { SectionPage } from "@/components/allocator/section-page";
import { PLReportsContent } from "@/app/allocator/pl-reports/page";
import { ImportContent } from "@/app/allocator/import/page";
import { useEffect, useState } from "react";
import { useFund } from "@/contexts/fund-context";

export default function PLPage() {
  const { fundId } = useFund();
  const [pendingPLCount, setPendingPLCount] = useState(0);

  useEffect(() => {
    if (!fundId) return;
    fetch(`/api/allocator/badges?fundId=${fundId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPendingPLCount(data.pendingPLCount ?? 0);
      })
      .catch(() => {});
  }, [fundId]);

  return (
    <SectionPage
      title="P&L"
      description="Import profit & loss from Tychi GL and track allocation readiness by period."
      defaultTab="reports"
      tabs={[
        {
          id: "reports",
          label: "Reports",
          badge: pendingPLCount,
          badgeVariant: "orange",
        },
        { id: "import", label: "Import from Tychi" },
      ]}
    >
      {(tab) =>
        tab === "reports" ? (
          <PLReportsContent
            embedded
            onImported={() => {
              fetch(`/api/allocator/badges?fundId=${fundId}`)
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                  if (data) setPendingPLCount(data.pendingPLCount ?? 0);
                })
                .catch(() => {});
            }}
          />
        ) : (
          <ImportContent embedded />
        )
      }
    </SectionPage>
  );
}
