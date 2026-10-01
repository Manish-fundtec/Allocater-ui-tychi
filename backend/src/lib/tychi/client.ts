import { getEnv } from "../../config/env";
import * as settingsModel from "../../models/settings.model";

export async function fetchTychiPL(
  period: string,
  fundExternalId?: string,
): Promise<{
  net_profit: number;
  gross_revenue: number;
  total_expenses: number;
  raw: Record<string, unknown>;
}> {
  const env = getEnv();
  const baseUrl =
    (await settingsModel.getSetting("TYCHI_API_BASE_URL")) ??
    env.TYCHI_API_BASE_URL ??
    "";
  const apiKey =
    (await settingsModel.getSetting("TYCHI_API_KEY")) ??
    env.TYCHI_API_KEY ??
    "";

  if (!baseUrl || !apiKey) {
    throw new Error("Tychi GL API is not configured");
  }

  const url = new URL("/reports/pl", baseUrl.replace(/\/$/, ""));
  url.searchParams.set("period", period);
  if (fundExternalId) url.searchParams.set("fundId", fundExternalId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Tychi API error: ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  if (typeof data.net_profit !== "number") {
    throw new Error("Invalid Tychi response: missing net_profit");
  }

  return {
    net_profit: data.net_profit as number,
    gross_revenue: Number(data.gross_revenue ?? 0),
    total_expenses: Number(data.total_expenses ?? 0),
    raw: data,
  };
}

export async function testTychiConnection(): Promise<boolean> {
  const env = getEnv();
  const baseUrl =
    (await settingsModel.getSetting("TYCHI_API_BASE_URL")) ??
    env.TYCHI_API_BASE_URL;
  const apiKey =
    (await settingsModel.getSetting("TYCHI_API_KEY")) ?? env.TYCHI_API_KEY;
  if (!baseUrl || !apiKey) return false;

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return res.ok;
}
