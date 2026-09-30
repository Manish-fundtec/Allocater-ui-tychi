import { cn } from "@/lib/utils";

type DataPanelProps = {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
};

/** Standard elevated surface for tables and dense content */
export function DataPanel({
  children,
  className,
  noPadding = false,
}: DataPanelProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-gray-200/90 bg-white",
        "shadow-[var(--shadow-sm)] ring-1 ring-black/[0.03]",
        !noPadding && "p-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
