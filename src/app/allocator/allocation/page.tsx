"use client";

import { SectionPage } from "@/components/allocator/section-page";
import { NewAllocationButton } from "@/components/allocator/page-header";
import { RunAllocationContent } from "@/app/allocator/allocation/run/page";
import { FeeReviewContent } from "@/app/allocator/fees/review/page";
import { AllocationHistoryContent } from "@/app/allocator/allocation/history/page";
import { FeeStructureContent } from "@/app/allocator/fees/page";

export default function AllocationPage() {
  return (
    <SectionPage
      title="Allocation"
      description="Configure fees, review calculations, run allocations, and view history."
      defaultTab="run"
      action={<NewAllocationButton />}
      tabs={[
        { id: "run", label: "Run" },
        { id: "review", label: "Fee Review" },
        { id: "history", label: "History" },
        { id: "structure", label: "Fee Structure" },
      ]}
    >
      {(tab) => {
        switch (tab) {
          case "review":
            return <FeeReviewContent embedded />;
          case "history":
            return <AllocationHistoryContent embedded />;
          case "structure":
            return <FeeStructureContent embedded />;
          default:
            return <RunAllocationContent embedded />;
        }
      }}
    </SectionPage>
  );
}
