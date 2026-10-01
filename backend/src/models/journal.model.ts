import type { PoolClient } from "pg";
import { query } from "../db/pool";
import { decryptFundField } from "../lib/encryption";
import { ApiError } from "../lib/errors";
import { roundNav } from "../lib/nav/periodNav";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FeeAccounts = {
  expenseCode: string;
  payableCode: string;
};

export type MgmtFeeAccounts = FeeAccounts;

type FeeAccrualSpec = {
  expenseName: string;
  payableName: string;
  expenseLabel: string;
  payableLabel: string;
  journalType: string;
  docPrefix: string;
  description: (period: string) => string;
};

const MGMT_FEE: FeeAccrualSpec = {
  expenseName: "management fee",
  payableName: "management fee payable",
  expenseLabel: "Management Fee",
  payableLabel: "Management Fee Payable",
  journalType: "Management Fee Accrual",
  docPrefix: "ALLOC-MGMT",
  description: (period) => `Allocator management fee accrual for ${period}`,
};

const PERF_FEE: FeeAccrualSpec = {
  expenseName: "performance fee",
  payableName: "performance fee payable",
  expenseLabel: "Performance Fee",
  payableLabel: "Performance Fee Payable",
  journalType: "Performance Fee Accrual",
  docPrefix: "ALLOC-PERF",
  description: (period) => `Allocator performance fee accrual for ${period}`,
};

function documentNumber(
  spec: FeeAccrualSpec,
  fundId: string,
  period: string,
): string {
  return `${spec.docPrefix}:${fundId}:${period}`.slice(0, 100);
}

function pnlDocumentNumber(fundId: string, period: string): string {
  return `ALLOC-PNL:${fundId}:${period}`.slice(0, 100);
}

function fundCurrency(raw: unknown): string {
  const value = decryptFundField(raw)?.trim().toUpperCase();
  return value || "USD";
}

async function rows<T extends Record<string, unknown>>(
  client: PoolClient | null,
  text: string,
  params: unknown[],
): Promise<T[]> {
  if (client) {
    const result = await client.query<T>(text, params);
    return result.rows;
  }
  return query<T>(text, params);
}

function pickCode(
  accounts: { account_code: string; account_name: string }[],
  name: string,
): string | null {
  const matches = accounts
    .filter((row) => row.account_name === name && row.account_code)
    .sort((a, b) => a.account_code.localeCompare(b.account_code));
  return matches[0]?.account_code ?? null;
}

async function resolveFeeAccounts(
  fundId: string,
  spec: FeeAccrualSpec,
  client: PoolClient | null = null,
): Promise<FeeAccounts> {
  const accounts = await rows<{ account_code: string; account_name: string }>(
    client,
    `SELECT TRIM(account_code) AS account_code,
            LOWER(TRIM(account_name)) AS account_name
     FROM chartofaccounts
     WHERE fund_id::text = $1
       AND LOWER(TRIM(account_name)) IN ($2, $3)`,
    [fundId, spec.expenseName, spec.payableName],
  );

  const expenseCode = pickCode(accounts, spec.expenseName);
  const payableCode = pickCode(accounts, spec.payableName);

  if (!expenseCode || !payableCode) {
    const missing = [
      !expenseCode ? spec.expenseLabel : null,
      !payableCode ? spec.payableLabel : null,
    ]
      .filter(Boolean)
      .join(" and ");
    throw new ApiError(
      `Chart of accounts for this fund is missing ${missing}. Add the account in Tychi GL, then run allocation again.`,
      400,
    );
  }

  return { expenseCode, payableCode };
}

export async function resolveMgmtFeeAccounts(
  fundId: string,
  client: PoolClient | null = null,
): Promise<FeeAccounts> {
  return resolveFeeAccounts(fundId, MGMT_FEE, client);
}

export async function resolvePerfFeeAccounts(
  fundId: string,
  client: PoolClient | null = null,
): Promise<FeeAccounts> {
  return resolveFeeAccounts(fundId, PERF_FEE, client);
}

export async function resolveRetainedEarningAccount(
  fundId: string,
  client: PoolClient | null = null,
): Promise<string> {
  const accounts = await rows<{ account_code: string; account_name: string }>(
    client,
    `SELECT TRIM(account_code) AS account_code,
            LOWER(TRIM(account_name)) AS account_name
     FROM chartofaccounts
     WHERE fund_id::text = $1
       AND LOWER(TRIM(account_name)) IN ('retained earning', 'retained earnings')`,
    [fundId],
  );
  const accountCode =
    pickCode(accounts, "retained earning") ??
    pickCode(accounts, "retained earnings");
  if (!accountCode) {
    throw new ApiError(
      "Chart of accounts for this fund is missing Retained Earning. Add the account in Tychi GL, then run allocation again.",
      400,
    );
  }
  return accountCode;
}

async function findPostedJournalId(
  client: PoolClient,
  fundId: string,
  doc: string,
): Promise<string | null> {
  const existing = await client.query<{ journal_id: string }>(
    `SELECT journal_id::text
     FROM journals
     WHERE fund_id = $1::uuid
       AND document_number = $2
       AND status = 'posted'
     ORDER BY created_at DESC NULLS LAST
     LIMIT 1`,
    [fundId, doc],
  );
  return existing.rows[0]?.journal_id ?? null;
}

async function loadFundJournalContext(
  client: PoolClient,
  fundId: string,
): Promise<{ orgId: string | null; currency: string }> {
  const fund = await client.query<{
    org_id: string | null;
    reporting_currency: unknown;
  }>(
    `SELECT org_id::text, reporting_currency
     FROM funds
     WHERE fund_id = $1::uuid`,
    [fundId],
  );
  const fundRow = fund.rows[0];
  if (!fundRow) {
    throw new ApiError("Fund not found", 400);
  }
  return {
    orgId: fundRow.org_id,
    currency: fundCurrency(fundRow.reporting_currency),
  };
}

type ProfitSplit = { name: string; amount: number };

function profitAllocationSplits(
  lines: { investor_name: string; gross_profit: number }[],
  fundProfit: number,
): ProfitSplit[] | null {
  const target = roundNav(Math.abs(fundProfit));
  if (!(target > 0)) return null;

  const nonzero = lines
    .map((line) => ({
      name: line.investor_name.trim() || "Investor",
      amount: roundNav(Math.abs(line.gross_profit)),
    }))
    .filter((line) => line.amount > 0);
  if (!nonzero.length) return null;

  const head = nonzero.slice(0, -1);
  const headSum = roundNav(head.reduce((sum, line) => sum + line.amount, 0));
  const lastAmount = roundNav(target - headSum);
  if (lastAmount > 0) {
    return [...head, { ...nonzero[nonzero.length - 1], amount: lastAmount }];
  }
  return head.length ? head : null;
}

async function postFeeAccrualJournal(
  client: PoolClient,
  spec: FeeAccrualSpec,
  params: {
    fundId: string;
    period: string;
    journalDate: string;
    amount: number;
    runBy: string;
    accounts: FeeAccounts;
  },
): Promise<string | null> {
  const amount = roundNav(params.amount);
  if (!(amount > 0)) return null;

  const doc = documentNumber(spec, params.fundId, params.period);
  const existingId = await findPostedJournalId(client, params.fundId, doc);
  if (existingId) return existingId;

  const fund = await loadFundJournalContext(client, params.fundId);
  const createdBy = UUID_RE.test(params.runBy) ? params.runBy : null;
  const description = spec.description(params.period);

  const inserted = await client.query<{ journal_id: string }>(
    `INSERT INTO journals (
       fund_id, org_id, journal_date, journal_type, document_number,
       description, status, source, base_currency, native_currency,
       base_amount, created_by
     )
     VALUES (
       $1::uuid, $2::uuid, $3::date, $4, $5,
       $6, 'posted', 'MANUAL', $7, $7,
       $8, $9::uuid
     )
     RETURNING journal_id::text`,
    [
      params.fundId,
      fund.orgId,
      params.journalDate,
      spec.journalType,
      doc,
      description,
      fund.currency,
      amount,
      createdBy,
    ],
  );
  const journalId = inserted.rows[0].journal_id;

  await client.query(
    `INSERT INTO journal_lines (
       journal_id, fund_id, account_code, gl_code, currency,
       debit_amount, credit_amount, fx_rate,
       debit_amount_base, credit_amount_base,
       description, line_number, line_order
     )
     VALUES
       ($1::uuid, $2::uuid, $3, $3, $5,
        $6, 0, 1, $6, 0, $7, 1, 1),
       ($1::uuid, $2::uuid, $4, $4, $5,
        0, $6, 1, 0, $6, $7, 2, 2)`,
    [
      journalId,
      params.fundId,
      params.accounts.expenseCode,
      params.accounts.payableCode,
      fund.currency,
      amount,
      description,
    ],
  );

  return journalId;
}

export async function postMgmtFeeAccrualJournal(
  client: PoolClient,
  params: {
    fundId: string;
    period: string;
    journalDate: string;
    amount: number;
    runBy: string;
    accounts: FeeAccounts;
  },
): Promise<string | null> {
  return postFeeAccrualJournal(client, MGMT_FEE, params);
}

export async function postPerfFeeAccrualJournal(
  client: PoolClient,
  params: {
    fundId: string;
    period: string;
    journalDate: string;
    amount: number;
    runBy: string;
    accounts: FeeAccounts;
  },
): Promise<string | null> {
  return postFeeAccrualJournal(client, PERF_FEE, params);
}

/**
 * Same Retained Earning GL on every line. Profit: Dr fund, Cr investors.
 * Loss: reverse. Totals always balance.
 */
export async function postProfitAllocationJournal(
  client: PoolClient,
  params: {
    fundId: string;
    period: string;
    journalDate: string;
    fundProfit: number;
    runBy: string;
    accountCode: string;
    lines: { investor_name: string; gross_profit: number }[];
  },
): Promise<string | null> {
  const splits = profitAllocationSplits(params.lines, params.fundProfit);
  if (!splits) return null;

  const total = roundNav(splits.reduce((sum, line) => sum + line.amount, 0));
  if (!(total > 0)) return null;

  const doc = pnlDocumentNumber(params.fundId, params.period);
  const existingId = await findPostedJournalId(client, params.fundId, doc);
  if (existingId) return existingId;

  const fund = await loadFundJournalContext(client, params.fundId);
  const createdBy = UUID_RE.test(params.runBy) ? params.runBy : null;
  const isLoss = params.fundProfit < 0;
  const kind = isLoss ? "Loss allocation" : "Profit allocation";
  const description = `Allocator ${kind.toLowerCase()} for ${params.period}`;

  const inserted = await client.query<{ journal_id: string }>(
    `INSERT INTO journals (
       fund_id, org_id, journal_date, journal_type, document_number,
       description, status, source, base_currency, native_currency,
       base_amount, created_by
     )
     VALUES (
       $1::uuid, $2::uuid, $3::date, 'Profit Allocation', $4,
       $5, 'posted', 'MANUAL', $6, $6,
       $7, $8::uuid
     )
     RETURNING journal_id::text`,
    [
      params.fundId,
      fund.orgId,
      params.journalDate,
      doc,
      description,
      fund.currency,
      total,
      createdBy,
    ],
  );
  const journalId = inserted.rows[0].journal_id;

  const drafts: {
    debit: number;
    credit: number;
    description: string;
  }[] = [];
  if (isLoss) {
    for (const split of splits) {
      drafts.push({
        debit: split.amount,
        credit: 0,
        description: `${kind} — ${split.name}`,
      });
    }
    drafts.push({
      debit: 0,
      credit: total,
      description: `${kind} — fund`,
    });
  } else {
    drafts.push({
      debit: total,
      credit: 0,
      description: `${kind} — fund`,
    });
    for (const split of splits) {
      drafts.push({
        debit: 0,
        credit: split.amount,
        description: `${kind} — ${split.name}`,
      });
    }
  }

  for (let i = 0; i < drafts.length; i += 1) {
    const line = drafts[i];
    await client.query(
      `INSERT INTO journal_lines (
         journal_id, fund_id, account_code, gl_code, currency,
         debit_amount, credit_amount, fx_rate,
         debit_amount_base, credit_amount_base,
         description, line_number, line_order
       )
       VALUES (
         $1::uuid, $2::uuid, $3, $3, $4,
         $5, $6, 1, $5, $6,
         $7, $8, $8
       )`,
      [
        journalId,
        params.fundId,
        params.accountCode,
        fund.currency,
        line.debit,
        line.credit,
        line.description,
        i + 1,
      ],
    );
  }

  return journalId;
}
