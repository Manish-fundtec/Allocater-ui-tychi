"use client";

import { Info, X } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "allocator_demo_banner_dismissed";

export function DemoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MOCK_UI !== "true") return;
    setVisible(localStorage.getItem(STORAGE_KEY) !== "1");
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-violet-200/80 bg-gradient-to-r from-violet-50 to-indigo-50/80 px-4 py-3 shadow-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
      <p className="flex-1 text-sm leading-relaxed text-violet-950/90">
        <span className="font-medium">Preview mode</span> — showing sample data.
        Connect your database later via{" "}
        <code className="rounded bg-white/70 px-1 py-0.5 text-xs">.env.local</code>
        .
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setVisible(false);
        }}
        className="rounded-lg p-1 text-violet-600/70 transition hover:bg-white/60 hover:text-violet-900"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
