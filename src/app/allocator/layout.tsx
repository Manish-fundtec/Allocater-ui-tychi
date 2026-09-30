import { AllocatorShell } from "@/components/allocator/allocator-shell";

export const metadata = {
  title: "Tychi Allocator | FundTec",
};

export default function AllocatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AllocatorShell>{children}</AllocatorShell>;
}
