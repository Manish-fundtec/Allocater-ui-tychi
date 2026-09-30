"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronDown,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Play,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useFund } from "@/contexts/fund-context";
import { getInitials } from "@/lib/allocator/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeVariant?: "blue" | "orange" | "red";
};

type BadgeCounts = {
  investorCount: number;
  pendingPLCount: number;
  unsentReportsCount: number;
};

const BADGE_REFRESH_MS = 5 * 60 * 1000;

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/allocator", icon: LayoutDashboard },
  {
    label: "Investor",
    href: "/allocator/fund",
    icon: Users,
    badgeVariant: "blue",
  },
  {
    label: "P&L",
    href: "/allocator/pl",
    icon: Wallet,
    badgeVariant: "orange",
  },
  { label: "Allocation", href: "/allocator/allocation", icon: Play },
  { label: "Reports", href: "/allocator/reports", icon: FileSpreadsheet },
];

function NavLink({
  item,
  badges,
}: {
  item: NavItem;
  badges: BadgeCounts;
}) {
  const pathname = usePathname();
  const active =
    item.href === "/allocator"
      ? pathname === "/allocator"
      : pathname.startsWith(item.href);

  const badge =
    item.href === "/allocator/fund"
      ? badges.investorCount
      : item.href === "/allocator/pl"
        ? badges.pendingPLCount
        : undefined;

  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
        active
          ? "bg-[#EEEDFE] text-[#3C3489] shadow-sm ring-1 ring-[#534AB7]/10"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-[#534AB7]" : "text-slate-400",
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {badge != null && badge > 0 ? (
        <Badge
          variant={
            item.badgeVariant === "red"
              ? "red"
              : item.badgeVariant === "orange"
                ? "orange"
                : "blue"
          }
          className="ml-auto min-w-[1.25rem] justify-center px-1.5"
        >
          {badge}
        </Badge>
      ) : null}
    </Link>
  );
}

function SidebarNav({ badges }: { badges: BadgeCounts }) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} badges={badges} />
      ))}
    </nav>
  );
}

export function AllocatorSidebarContent() {
  const { funds, fundId, selectedFund, setFundId, loading } = useFund();
  const [badges, setBadges] = useState<BadgeCounts>({
    investorCount: 0,
    pendingPLCount: 0,
    unsentReportsCount: 0,
  });

  useEffect(() => {
    if (!fundId) return;

    const fetchBadges = async () => {
      try {
        const res = await fetch(`/api/allocator/badges?fundId=${fundId}`);
        if (res.ok) {
          setBadges(await res.json());
        }
      } catch {
        /* ignore */
      }
    };

    fetchBadges();
    const interval = setInterval(fetchBadges, BADGE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fundId]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-100/90 px-4 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#534AB7] shadow-sm shadow-[#534AB7]/30">
            <span className="h-2 w-2 rounded-full bg-white/90" />
          </span>
          <span className="text-sm font-bold tracking-tight text-slate-900">
            Tychi Allocator
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="mt-4 flex w-full items-center gap-2 rounded-lg border border-gray-200/90 bg-slate-50/80 px-3 py-2.5 text-left text-sm shadow-sm transition hover:border-gray-300 hover:bg-white"
              disabled={loading || funds.length === 0}
            >
              <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="flex-1 truncate font-medium text-slate-800">
                {loading
                  ? "Loading..."
                  : (selectedFund?.name ?? "Select fund")}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[186px]" align="start">
            {funds.map((fund) => (
              <DropdownMenuItem
                key={fund.id}
                onClick={() => setFundId(fund.id)}
                className={cn(fund.id === fundId && "bg-[#EEEDFE] text-[#3C3489]")}
              >
                {fund.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SidebarNav badges={badges} />

      <div className="mt-auto border-t border-gray-100/90 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50/60 p-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#534AB7] to-[#6d63d4] text-xs font-semibold text-white shadow-sm">
            {getInitials("Rahul A.")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">Rahul A.</p>
            <p className="truncate text-xs text-slate-500">Fund Manager</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
