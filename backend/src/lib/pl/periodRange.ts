/** Calendar month bounds for allocator period key YYYY-MM. */
export function periodMonthRange(period: string): { start: string; end: string } {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) {
    throw new Error(`Invalid period: ${period}`);
  }
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${period}-01`,
    end: `${period}-${String(lastDay).padStart(2, "0")}`,
  };
}
