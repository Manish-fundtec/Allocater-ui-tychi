"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Fund = {
  id: string;
  name: string;
  currency: string;
};

type FundContextValue = {
  funds: Fund[];
  fundId: string | null;
  selectedFund: Fund | null;
  setFundId: (id: string) => void;
  loading: boolean;
  error: string | null;
  refreshFunds: () => Promise<Fund[]>;
};

const FundContext = createContext<FundContextValue | null>(null);

const STORAGE_KEY = "allocator_fund_id";

export function FundProvider({ children }: { children: ReactNode }) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [fundId, setFundIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshFunds = useCallback(async () => {
    const res = await fetch("/api/funds");
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Failed to load funds");
    }
    const data: Fund[] = await res.json();
    setFunds(data);
    setError(null);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await refreshFunds();
        if (cancelled) return;
        const stored =
          typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEY)
            : null;
        const initial =
          stored && data.some((f) => f.id === stored)
            ? stored
            : data[0]?.id ?? null;
        setFundIdState(initial);
      } catch (e) {
        if (!cancelled) {
          setFunds([]);
          setError(e instanceof Error ? e.message : "Failed to load funds");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshFunds]);

  const setFundId = useCallback((id: string) => {
    setFundIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const selectedFund = useMemo(
    () => funds.find((f) => f.id === fundId) ?? null,
    [funds, fundId],
  );

  const value = useMemo(
    () => ({
      funds,
      fundId,
      selectedFund,
      setFundId,
      loading,
      error,
      refreshFunds,
    }),
    [funds, fundId, selectedFund, setFundId, loading, error, refreshFunds],
  );

  return (
    <FundContext.Provider value={value}>{children}</FundContext.Provider>
  );
}

export function useFund() {
  const ctx = useContext(FundContext);
  if (!ctx) {
    throw new Error("useFund must be used within FundProvider");
  }
  return ctx;
}
