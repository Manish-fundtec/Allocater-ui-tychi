"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200/90 bg-white text-slate-500 shadow-sm transition hover:border-gray-300 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
          </button>
          {action}
        </div>
      </div>
    </div>
  );
}

export function NewAllocationButton() {
  return (
    <Button size="lg" asChild>
      <a href="/allocator/allocation?tab=run">+ New Allocation</a>
    </Button>
  );
}
