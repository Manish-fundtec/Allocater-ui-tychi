"use client";

import { SectionPage } from "@/components/allocator/section-page";
import { SettingsContent } from "@/app/allocator/settings/page";
import { InvestorAllocationReportContent } from "@/components/allocator/investor-allocation-report";
import { InvestorStatementReportContent } from "@/components/allocator/investor-statement-report";
import { InvestorRegisterReportContent } from "@/components/allocator/investor-register-report";

function ReportsSectionPage() {
  const defaultTab = "allocation";

  return (
    <SectionPage
      title="Reports"
      description="Period-wise investor allocation, statements, and the investor register. Download Excel or PDF from each report."
      defaultTab={defaultTab}
      tabs={[
        { id: "allocation", label: "Investor Allocation" },
        { id: "statement", label: "Investor Statement" },
        { id: "register", label: "Investor Register" },
        { id: "settings", label: "Settings" },
      ]}
    >
      {(current) => {
        if (current === "settings") return <SettingsContent embedded />;
        if (current === "statement") return <InvestorStatementReportContent />;
        if (current === "register") return <InvestorRegisterReportContent />;
        return <InvestorAllocationReportContent />;
      }}
    </SectionPage>
  );
}

export default function ReportsPage() {
  return <ReportsSectionPage />;
}
