"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SectionTab = {
  id: string;
  label: string;
  badge?: number;
  badgeVariant?: "blue" | "orange" | "red";
};

type SectionPageProps = {
  title: string;
  description?: string;
  tabs: SectionTab[];
  defaultTab: string;
  action?: React.ReactNode;
  children: (tabId: string) => React.ReactNode;
  className?: string;
};

export function SectionPage({
  title,
  description,
  tabs,
  defaultTab,
  action,
  children,
  className,
}: SectionPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") ?? defaultTab;

  function onTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className={cn("min-h-0", className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className="flex shrink-0 items-center gap-2">{action}</div>
        ) : null}
      </div>

      <Tabs value={currentTab} onValueChange={onTabChange}>
        <TabsList className="mb-0 h-auto flex-wrap gap-0">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              {tab.label}
              {tab.badge != null && tab.badge > 0 ? (
                <Badge
                  variant={
                    tab.badgeVariant === "red"
                      ? "red"
                      : tab.badgeVariant === "orange"
                        ? "orange"
                        : "blue"
                  }
                  className="min-w-[1.25rem] justify-center px-1.5 py-0 text-[10px]"
                >
                  {tab.badge}
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            {children(tab.id)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
