import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none",
  {
    variants: {
      variant: {
        default: "border-violet-200/80 bg-[#EEEDFE] text-[#3C3489]",
        green: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
        orange: "border-amber-200/80 bg-amber-50 text-amber-800",
        red: "border-red-200/80 bg-red-50 text-red-700",
        gray: "border-gray-200 bg-slate-50 text-slate-600",
        blue: "border-blue-200/80 bg-blue-50 text-blue-700",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
