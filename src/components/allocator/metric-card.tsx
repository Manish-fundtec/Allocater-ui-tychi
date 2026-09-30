import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  valueClassName?: string;
};

export function MetricCard({
  label,
  value,
  subtitle,
  valueClassName,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200/90 bg-white p-5",
        "shadow-[var(--shadow-sm)] ring-1 ring-black/[0.03]",
        "transition-shadow duration-200 hover:shadow-[var(--shadow-md)]",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </p>
      {subtitle ? (
        <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}
