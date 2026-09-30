export function formatCurrency(
  amount: number,
  currency = "INR",
  compact = false,
): string {
  if (currency === "INR") {
    if (compact && Math.abs(amount) >= 100000) {
      const lakhs = amount / 100000;
      const sign = amount < 0 ? "−" : "";
      return `${sign}₹${Math.abs(lakhs).toFixed(1)}L`;
    }
    const sign = amount < 0 ? "−" : "";
    return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    })}`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatProfit(amount: number | null | undefined): string {
  if (amount == null) return "—";
  const sign = amount >= 0 ? "+" : "−";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

export function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-");
  if (!year || !month) return period;
  const d = new Date(Number(year), Number(month) - 1, 1);
  const short = d.toLocaleDateString("en-IN", { month: "short" });
  const yy = String(year).slice(-2);
  return `${short} ${yy}`;
}

export function formatPeriodLong(period: string): string {
  const [year, month] = period.split("-");
  if (!year || !month) return period;
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function avatarColor(name: string): string {
  const colors = [
    "#534AB7",
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
  ];
  const code = name.charCodeAt(0) || 0;
  return colors[code % colors.length];
}
