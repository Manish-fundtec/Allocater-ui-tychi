"use client";

import { Menu } from "lucide-react";
import { FundProvider } from "@/contexts/fund-context";
import { AllocatorSidebarContent } from "@/components/allocator/sidebar";
import { DemoBanner } from "@/components/allocator/demo-banner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function AllocatorShell({ children }: { children: React.ReactNode }) {
  return (
    <FundProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--background)]">
        <aside className="relative z-20 hidden w-[200px] shrink-0 border-r border-gray-200/80 bg-white shadow-[4px_0_24px_rgba(15,23,42,0.04)] lg:flex lg:flex-col">
          <AllocatorSidebarContent />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center border-b border-gray-200/80 bg-white/90 px-4 py-3 backdrop-blur-sm lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[200px] border-r p-0 shadow-xl">
                <AllocatorSidebarContent />
              </SheetContent>
            </Sheet>
            <span className="ml-2 text-sm font-semibold tracking-tight text-slate-900">
              Tychi Allocator
            </span>
          </div>

          <main className="flex-1 overflow-y-auto">
            <div className="w-full px-4 py-6 lg:px-6 lg:py-7">
              <DemoBanner />
              {children}
            </div>
          </main>
        </div>
      </div>
    </FundProvider>
  );
}
