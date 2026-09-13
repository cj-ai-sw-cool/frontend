"use client";

/** 허브 "센터" 탭 — `GET /hub/centers` 3곳 카드(칸·현재고·OPEN 주문), 정본 §12.6·§12.8 */

import { useHubCenters } from "../_data/use-hub";
import { w98 } from "./win98-ui";

export function CentersTab() {
  const { data: centers, isLoading, usingMock } = useHubCenters();

  if (isLoading) {
    return <span className="p-1 text-[13px] text-[color:var(--muted-foreground)]">센터 목록을 불러오는 중…</span>;
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {usingMock ? (
        <span className="w-fit bg-[color:var(--status-error)] px-1.5 py-0.5 text-[11px] font-bold text-white">
          /hub/centers 표본
        </span>
      ) : null}
      <div className="grid grid-cols-3 gap-3">
        {(centers ?? []).map((c) => (
          <div key={c.code} className={`${w98.raised} flex flex-col gap-2 bg-[color:var(--surface)] p-3`}>
            <span className="text-[18px] font-bold">{c.code}</span>
            <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{c.name}</span>

            <div className="mt-1 grid grid-cols-3 gap-1 text-center">
              <Stat label="칸" value={c.bins} />
              <Stat label="현재고" value={c.stockQty} />
              <Stat label="OPEN 주문" value={c.openOrders} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={`${w98.sunken} flex flex-col gap-0.5 p-1.5`}>
      <span className={`${w98.mono} text-[16px] font-bold`}>{value.toLocaleString()}</span>
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{label}</span>
    </div>
  );
}
