-- Link the performance-fee accrual journal to the allocation run.
ALTER TABLE allocation_runs
  ADD COLUMN IF NOT EXISTS perf_journal_id UUID REFERENCES journals(journal_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_allocation_runs_perf_journal_id
  ON allocation_runs(perf_journal_id);
