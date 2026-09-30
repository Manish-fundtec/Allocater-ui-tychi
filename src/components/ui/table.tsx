import { cn } from "@/lib/utils";

const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="relative w-full overflow-auto">
    <table
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
);

const TableHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("[&_tr]:border-b [&_tr]:border-gray-100", className)} {...props} />
);

const TableBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
);

const TableRow = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn(
      "border-b border-gray-100/90 transition-colors duration-150 hover:bg-slate-50/80",
      className,
    )}
    {...props}
  />
);

const TableHead = ({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      "h-11 bg-slate-50/90 px-5 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500",
      className,
    )}
    {...props}
  />
);

const TableCell = ({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td
    className={cn("px-5 py-4 align-middle text-sm text-slate-700", className)}
    {...props}
  />
);

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
