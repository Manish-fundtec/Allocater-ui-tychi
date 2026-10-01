# Profit allocation journal

Same GL on both sides: **Retained Earning → Retained Earning**, split across investors.

The trial balance of Retained Earning does not change (Dr = Cr). The lines record who received the period profit or loss.

Journal type: `Profit Allocation`

---

## Profit (example: 400)

Fund profit **400**, split 25% / 25% / 50%.

| Side | Account            | Who                 | Amount |
| ---- | ------------------ | ------------------- | ------ |
| Dr   | Retained Earning   | Fund / unallocated  | 400    |
| Cr   | Retained Earning   | Investor A          | 100    |
| Cr   | Retained Earning   | Investor B          | 100    |
| Cr   | Retained Earning   | Investor C          | 200    |

Totals: Dr 400 = Cr 400.

## Loss (example: 400)

Same accounts and amounts. **Dr / Cr reversed.**

| Side | Account            | Who                 | Amount |
| ---- | ------------------ | ------------------- | ------ |
| Dr   | Retained Earning   | Investor A          | 100    |
| Dr   | Retained Earning   | Investor B          | 100    |
| Dr   | Retained Earning   | Investor C          | 200    |
| Cr   | Retained Earning   | Fund / unallocated  | 400    |

---

## Amount

- Per investor: allocation line **`gross_profit`** (capital % of fund profit).
- That is the profit-allocation split. Example: 25% / 25% / 50% of 400 → 100 / 100 / 200.
- Management and performance fees stay on their own journals (`Management Fee Accrual`, `Performance Fee Accrual`).
- Investor NAV still uses **`net_profit`** (gross − mgmt − perf).
- Skip this journal when rounded total is **0**.
- Put rounding dust on the last investor so Dr equals Cr.

## COA lookup

- This **fund only**.
- Find account name **Retained Earning** (also accept **Retained Earnings**).
- Use that `account_code` on every line (typically `34000`).
- Missing account → fail before NAV write (same as fee journals).
- Do not seed a default COA here.

## Posting

- When: after allocation run completes, in the same DB transaction as NAV + fee journals.
- Date: period end.
- Document number: `ALLOC-PNL:{fundId}:{period}` — reuse if already posted.
- Source: `MANUAL`. Status: `posted`.

Tychi stores one `investor_name` on the journal header. Put the investor name on each line **description** (e.g. `Profit allocation — Investor A`).

---

## How it sits with fee journals

| Journal type               | Dr                              | Cr                                 | Amount            |
| -------------------------- | ------------------------------- | ---------------------------------- | ----------------- |
| Management Fee Accrual     | Management Fee                  | Management Fee Payable             | Σ `mgmt_fee`      |
| Performance Fee Accrual    | Performance Fee                 | Performance Fee Payable            | Σ `perf_fee`      |
| Profit Allocation (profit) | Retained Earning (fund)        | Retained Earning (investors)       | Σ `gross_profit`  |
| Profit Allocation (loss)   | Retained Earning (investors)    | Retained Earning (fund)           | Σ \|`gross_profit`\| |
