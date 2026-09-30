import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-gray-200/90 bg-white px-3.5 py-2 text-sm shadow-sm transition-colors",
        "placeholder:text-slate-400",
        "hover:border-gray-300",
        "focus-visible:border-[#534AB7]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]/20",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
