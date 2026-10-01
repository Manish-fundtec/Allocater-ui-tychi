/** Same as Tychi P&L report Net Income: Total Income − Total Expenses. */
export function netProfitFromIncomeExpense(
  grossRevenue: number,
  totalExpenses: number,
): number {
  return grossRevenue - totalExpenses;
}

export function resolveNetProfit(row: {
  net_profit?: string | number | null;
  gross_revenue?: string | number | null;
  total_expenses?: string | number | null;
}): number {
  const revenue = Number(row.gross_revenue ?? 0);
  const expenses = Number(row.total_expenses ?? 0);
  if (revenue !== 0 || expenses !== 0) {
    return netProfitFromIncomeExpense(revenue, expenses);
  }
  return Number(row.net_profit ?? 0);
}
