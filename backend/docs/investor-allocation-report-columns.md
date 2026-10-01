# Investor Allocation Report — data sources, formulas, and conditions

API: `GET /api/allocator/reports/investor-allocation?fundId=&period=`

**Fee Review** and **View breakdown** use this same report after a completed allocation. They do not recalculate from the live allocation engine.

The report is empty until there is a **completed** row in `allocation_runs` for that fund + period.

Gross Capital Balance is always equal to Net Capital Balance (no $500 spread on the report).

---

## 1. Where the numbers come from (tables vs allocation vs P&L)

Three kinds of input:

| Kind | What it means |
|---|---|
| **Portal / capital tables** | Who the investor is, class, and cash in/out this month |
| **Allocation** | Period is allocated; **fund total Gross MTD P&L** to split |
| **P&L (`pl_reports`)** | How that Gross MTD is split into Realized, Unrealized, fees, income |
| **Previous month’s report** | YTD P&L, HWM, YTD mgmt, original issue price, compounded return, accrued performance fee (carry-forward) |
| **Fee config** | Management fee % and hurdle % |
| **Calculated on the report** | Shares, Adj Opening, GAV, Net MTD/YTD, closing NAV, returns |

### Tables

| Table | Used for |
|---|---|
| `portal_investors` | Investor Name; Investor ID (`external_investor_id` if it is not a UUID; else BTMF name map) |
| `portal_capital_transactions` | Subscriptions / redemptions in the **calendar month** (`COALESCE(dealing_date, date)`); `class_description` → Terms Title (A / B); first dealing date (new vs existing) |
| `investor_capital_adjustments` | Onboarding $500 — **fund inception month only** |
| `investor_nav` | Opening YTD **capital** (year-end snapshot) only. Opening MTD comes from last month’s **report Closing** |
| `allocation_runs` | Gate: period must be `completed`. `total_profit` = **fund Gross MTD P&L** (the pot that is allocated by %) |
| `allocation_lines` | Who is on the report (investor list). Line-level `gross_profit` / `mgmt_fee` are **recomputed** on the report from Adj Opening % |
| `pl_reports.raw_json` | P&L line items: Unrealized, Dividend, Onboarding, Brokerage, KYC/AML, Bank, Admin, Professional Fees, Interest Income, Interest Expense, Org. GL management/performance fee accounts are **excluded** from these buckets |
| `fee_config` | `mgmt_fee_pct` (e.g. 0.25%), `hurdle_rate_pct`, `perf_fee_pct` |
| `funds` | Fund name on the report header |
| Previous period report (same API, recursive) | Opening MTD (Closing shares/NAV/capital), Opening YTD P&L, Prior HWM, Opening YTD Mgmt Fees, original issue price, Net YTD compounded, Opening Accrued Performance Fee |

### What does **not** drive the report

| Source | Why not |
|---|---|
| Current period `fund_period_nav.nav_per_share` (often 2 dp, e.g. 1928.27) | Issue Price/Share uses **prior closing NAV/share at full precision**, not this rounded price |
| `investor_nav.profit` (year-end) | Opening YTD P&L comes from last month’s **Closing YTD P&L** |
| Lifetime `transaction_charges` in later months | Would fake −$500 on follow-on buys and new joiners |

---

## 2. Column-by-column source

### Details

| Column | Source |
|---|---|
| Investor ID | `portal_investors.external_investor_id` if not a UUID; else name map (Bing Yang → BTMF0001, … Wang Pang → BTMF0006) |
| Investor Name | `portal_investors.name` |
| Terms Title | `portal_capital_transactions.class_description` (this month’s dealing first, else latest non-empty). Empty → **A**. Class B / `B` → **B** |

### Opening YTD (capital only)

Prior **calendar year-end** `investor_nav` (e.g. Mar-2025 still uses `2024-12` if that row exists). **Blank if the investor joined this month.**

| Column | Source |
|---|---|
| Number of Shares | `investor_nav.units` |
| NAV Per Share | net ÷ shares |
| Net / Gross Capital | `COALESCE(closing_nav, opening_nav)` — Gross = Net |

### Opening MTD

Previous allocator month’s **report Closing** (same numbers you see on last month’s Investor Allocation). Live allocation-engine recalc and `investor_nav` are fallbacks only if that report row is missing.

**Blank if the investor joined this month.**

| Column | Source |
|---|---|
| Number of Shares | Previous month report **Closing** shares |
| NAV Per Share | Previous month report **Closing** NAV/share |
| Net / Gross Capital | Previous month report **Closing** Net Capital. Gross = Net |

### Subscription / Redemption

| Column | Source |
|---|---|
| Amount | `portal_capital_transactions` in the calendar month: subscriptions − redemptions. Large same-month contra redemption is ignored. **Inception month only:** apply $500 onboarding from `investor_capital_adjustments` (see conditions). Blank if no flow |
| Issue Price/Share | **Not** this month’s rounded NAV. Existing investor: prior close net ÷ prior shares (full precision). New investor: that **share class** prior close. Inception month: **$2000** |
| Number of shares | Amount ÷ Issue Price/Share |
| Equalization Credit | Always blank |

### Adjusted Opening

| Column | Formula |
|---|---|
| Number of Shares | Opening MTD shares + sub/red shares |
| NAV Per Share | Issue price if there is a flow; else adj net ÷ adj shares |
| Net / Gross Capital | Opening MTD net + Amount. Gross = Net |
| Prior High Water Mark | Previous month **Adj High Water Mark**; **0** if new this month |
| Adj High Water Mark | Prior HWM + this month’s Amount |
| Allocation % | This investor Adj Opening net ÷ fund total Adj Opening net (fraction, not rounded to 2 dp) |

### P&L

**Fund Gross MTD** = `allocation_runs.total_profit` (allocation).

**Each investor Gross MTD** = fund total × Allocation %.

**Line items** = that bucket from `pl_reports.raw_json` × Allocation %. Account **name** (and GL code where noted) picks the bucket. Dividend is classified **before** realized so it is not left inside Realized. **Professional Fees** (GL 56200) and **Interest Expense** (GL 58000) are their own buckets — they must not fall through to Realized. Interest Expense is classified before Interest Income so “Interest Expense” is not treated as income. Management/performance fee GL lines are skipped here (they live in the mgmt/perf columns).

| Column | Source / formula |
|---|---|
| Opening YTD P&L | Previous month report **Closing YTD P&L**. **0** if new this month. Not `investor_nav.profit` |
| Realized P&L | Gross MTD − (Unrealized + Dividend + all other P&L buckets, including Professional Fees and Interest Expense) so nothing is double-counted |
| Unrealized P&L | P&L bucket × Allocation % (sign kept) |
| Onboarding / Brokerage / KYC / Bank / Admin / Professional Fees / Interest Income / Interest Expense / Org / Dividend | P&L bucket × Allocation % |
| Gross MTD P&L | `allocation_runs.total_profit × Allocation %` (before management fees) |
| Closing YTD P&L | Opening YTD P&L + Gross MTD P&L |

### Management fees (`fee_config`, then calculated)

Class B: MTD mgmt is blank (not eligible).

| Column | Formula |
|---|---|
| NAV_Prior Mgmt Fees | Adj Opening net + Gross MTD P&L |
| Opening YTD Mgmt Fees | Last month Opening YTD Mgmt + last month MTD Mgmt. **0** if new this month |
| MTD Mgmt Fees | Class A: `-(NAV_Prior × mgmt% / 12)`. See conditions for proration |
| Net MTD P&L | Gross MTD P&L + MTD Mgmt Fees + Performance Fees (P&L) |
| Net YTD P&L | Closing YTD P&L + Opening YTD Mgmt Fees + MTD Mgmt Fees + Accrued Performance Fees |

### Performance fees

Hurdle is **high-water-mark based**, not a monthly Gross MTD vs flat hurdle test. Day count is ACT/365 from the investor’s **original first subscription date** through this period’s NAV date (period end) — cumulative, not reset each month.

| Column | Source / formula |
|---|---|
| Subscription Date | Investor’s original first subscription / dealing date (carried every month). API: `subscriptionDate` |
| NAV Date | Period end date. API: `navDate` |
| Number of Days | ACT/365 calendar difference between Subscription Date and NAV Date. API: `hurdleDays` |
| GAV | NAV_Prior + MTD Mgmt Fees (before this month’s performance fee) |
| Hurdle Base | Adj High Water Mark × (1 + `fee_config.hurdle_rate_pct` × Days / 365). Dollar threshold. API: `hurdleBase` / `hurdleBaseAmount` |
| Hurdle Base (up 5%) | **Yes** if GAV > Hurdle Base ($), else **No**. API: `hurdleCrossed`. If No: Adjusted P&L, Tier 1, Tier 2, and Performance Fees (P&L) are blank — no performance fee this period |
| Adjusted P&L | GAV − Hurdle Base ($). Blank if hurdle not crossed |
| Tier 1 (up to 30% Net P&L) | `-(Adjusted P&L × perf_fee_pct%)` when hurdle is crossed (typically 20%). Blank if not crossed |
| Tier 2 (above 30% Net P&L) | **Not applied.** Rate and 30% breakpoint are unconfirmed with finance; never triggered in May–July 2025 |
| Opening Accrued Performance Fee | Prior period **Accrued Performance Fees** (0 / blank if new this month). API: `openingAccruedPerfFee` |
| Performance Fees Accrual / Accrued | Cumulative = Tier 1 + Tier 2 when hurdle is crossed. If not crossed, prior accrual is carried (not reversed). **First-crossing month:** currently equal to this month’s Performance Fees (P&L); the Excel reference shows 0 until the following month — pending finance confirmation |
| Performance Fees (P&L) | Accrued (current) − Opening Accrued. This is the month’s P&L/expense hit — not the full cumulative amount |
| Performance Fee Paid | Not populated |

### Closing (calculated)

| Column | Formula |
|---|---|
| Number of Shares | Adjusted Opening shares |
| NAV Per Share | Closing Net Capital ÷ Shares |
| Net / Gross Capital | Adj Opening net + Net MTD P&L. Gross = Net |

### Rate of Return (%) — calculated (stored as a fraction)

| Column | Formula |
|---|---|
| Net MTD | (Closing NAV/share − Opening MTD NAV/share or issue) / opening |
| Gross MTD | Same using GAV per share vs opening |
| Abs YTD | (Closing NAV/share − original issue price) / original issue price |
| Net YTD (compounded Return) | `(1 + prior month compounded) × (1 + Net MTD) − 1` |
| Gross YTD | Same as Abs YTD |

Original issue price = NAV/share at first subscription (**$2000** at inception) and is carried on the report each month.

### Totals and Check

- **Total** — sum of money/share columns; Allocation % = 1 (100%).
- **Check** — Amount recon 0; Allocation % sum − 1; P&L lines vs Gross MTD; Gross MTD + MTD Mgmt + Perf P&L vs Net MTD; Opening YTD P&L + Gross MTD vs Closing YTD; Adj net + Net MTD vs closing net.

---

## 3. Conditions (rules the report always applies)

1. **No completed `allocation_runs` row** → report is empty (`allocated: false`).
2. **Gross Capital = Net Capital** on every capital column.
3. **Class B** → no MTD management fee.
4. **Onboarding $500** from `investor_capital_adjustments` applies **only in the fund inception month** (everyone’s first dealing is that month). Later months: portal Amount as-is.
5. **Inception Amount rules:** typical booked − $500; Class A exact share lot at $2000 (e.g. Wendi 50.00) → credit $500 (portal already net); Class B exact lot still deducts $500.
6. **Opening MTD / Opening YTD capital / Opening YTD P&L / Prior HWM / Opening YTD Mgmt** are **empty or 0** if this is the investor’s **first dealing month**.
7. **Issue Price/Share** is prior closing NAV/share at full precision. Never the current period’s 2-decimal `fund_period_nav`. Inception month issue = **$2000**.
8. **MTD Mgmt Fees — brand-new investor** (no Opening MTD, fund already running): **full month**, `-(NAV_Prior × mgmt% / 12)`, **no** (accrual days / days in month). Example: Wang Pang Mar-2025 → -39.89, not a mid-month prorate.
9. **MTD Mgmt Fees — fund inception month:** still prorate from dealing date through month end (e.g. Bing Feb-2025 → 12/28 days).
10. **MTD Mgmt Fees — existing investor:** full calendar month (no dealing-date proration) unless a later redemption/accrual-day rule is added.
11. **Performance fee** only if **GAV > Hurdle Base ($)** (Adj HWM compounded at the annual hurdle over ACT/365 days from first subscription). Otherwise no performance fee this period, regardless of this month’s Gross MTD.
12. **Dividend** is its own column; Realized is the residual so dividend is not counted twice.
13. **Closing YTD P&L** = Opening YTD P&L + **Gross** MTD (not Net MTD).
14. **Penny residual:** investor Gross MTD figures are rounded to 2 dp; any leftover cents vs `allocation_runs.total_profit` is applied to the last investor so the Total matches the fund.
15. **Fee Review / breakdown** after allocation = this report (same Gross MTD, MTD Mgmt, Net MTD, GAV, closing).

---

## 4. What happens when a **new investor** joins

Example: **Wang Pang (BTMF0006), March 2025** — first dealing this month, fund already had February.

| What | What the report does |
|---|---|
| Opening YTD (shares / NAV / capital) | **Blank** — no year-end row for them |
| Opening MTD | **Blank** — no prior month close |
| Opening YTD P&L | **0** |
| Prior High Water Mark | **0** |
| Opening YTD Mgmt Fees | **0** |
| Amount | Portal subscription as-is (e.g. 199,500). **No** $500 onboarding (not inception month) |
| Issue Price/Share | **Share class** prior closing NAV/share (full precision), not $2000 |
| Shares issued | Amount ÷ Issue Price |
| Adj Opening | 0 + Amount |
| Adj HWM | 0 + Amount |
| Allocation % | Their Adj Opening ÷ fund total Adj Opening (they take a slice of this month’s P&L) |
| Gross MTD P&L | Fund `total_profit` × their new % |
| MTD Mgmt Fees | **Full month** on NAV_Prior (no day proration) if Class A |
| Net YTD P&L | Same as Net MTD (no prior YTD) |
| Abs YTD / compounded | From this month’s issue price / this month’s Net MTD only |
| Check row | They are included in Total Amount, Allocation %, P&L, capital tie-out |

They appear on the report only if they are on the **completed allocation** for that period (they must have a dealing date on or before period end).

---

## 5. What happens when an **existing investor** adds more money

Example: **Jiachen Tang (BTMF0005), March 2025** — already in the fund, additional subscription 240,000.

| What | What the report does |
|---|---|
| Opening MTD | Last month’s closing shares / NAV / capital (carried) |
| Opening YTD P&L | Last month’s **Closing YTD P&L** |
| Prior HWM | Last month’s **Adj HWM** (does not reset to current NAV) |
| Opening YTD Mgmt | Last month Opening YTD Mgmt + last month MTD Mgmt |
| Amount | Portal additional subscription as-is. **No** extra −$500 |
| Issue Price/Share | **This investor’s** prior closing NAV/share (full precision), e.g. ~1928.448266 not 1928.27 |
| New shares | Amount ÷ Issue Price |
| Adj Opening shares / net | Opening MTD + new shares / Opening MTD net + Amount |
| Adj HWM | Prior HWM **+ this month’s Amount** |
| Allocation % | Recalculated on **new** Adj Opening (they get a larger % of this month’s P&L) |
| Gross MTD | New % × fund `total_profit` |
| MTD Mgmt | Full month on NAV_Prior (existing investor, Class A) |
| Closing YTD P&L | Prior YTD + this month Gross MTD |
| Original issue price | Unchanged (still inception $2000) — Abs YTD is vs original issue, not vs this follow-on price |

A **redemption** is the same path with a **negative** Amount: Adj Opening and Adj HWM go down; shares redeemed = Amount ÷ Issue Price.

---

## 6. Quick map: allocation vs P&L vs portal

| Question | Answer |
|---|---|
| Is the period allowed to show a report? | `allocation_runs` (completed) |
| How big is the fund P&L pot this month? | `allocation_runs.total_profit` |
| How is that pot split **across investors**? | Allocation % from Adj Opening (portal capital + prior close) |
| How is each investor’s Gross MTD split into Realized / Unrealized / fees / income? | `pl_reports.raw_json` buckets × Allocation % |
| How much cash did they put in this month? | `portal_capital_transactions` |
| Who are they / which class? | `portal_investors` + `class_description` |
| What is YTD from last month? | Previous month’s **report**, not a P&L table |
| What is the mgmt %? | `fee_config` |
| What is closing capital? | Calculated: Adj Opening + Net MTD P&L |

---

## 7. Code

| Piece | File |
|---|---|
| Report API | `src/services/investorAllocationReport.service.ts` |
| Columns / formulas / Check row | `src/lib/reports/investorAllocationReport.ts` |
| HWM / hurdle performance fee | `src/lib/allocation/performanceFee.ts` |
| P&L buckets | `src/lib/pl/parsePlRows.ts` |
| Amount / $500 onboarding | `src/lib/allocation/subscriptionAmount.ts` |
| Fee Review / breakdown (same numbers) | `src/lib/allocation/reportFeeReview.ts` |
