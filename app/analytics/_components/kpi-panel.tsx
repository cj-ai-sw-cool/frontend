"use client";

/**
 * KPI 패널 — 브리프 §3 "KPI 패널(3D 좌측 대시보드 자리 재사용): `GET /events/kpi`".
 * 관제 모드가 켜지면 `warehouse-slot-3d.tsx`가 기존 점유율 대시보드 대신 이 패널을
 * 그 자리에 올린다. `GET /events/kpi`가 아직 없으면(백엔드 작업 중) 최근 이벤트 버퍼로
 * 대충 계산한 값을 대신 보여준다 — 정확한 서버 집계가 아니라는 뜻으로 배지를 단다.
 */

import { useMemo } from "react";
import { useEventsKpi } from "@/lib/use-events";
import type { InventoryTxType, WmsEvent } from "@/lib/types";

interface KpiPanelProps {
  center: string;
  recentEvents: WmsEvent[];
}

export function KpiPanel({ center, recentEvents }: KpiPanelProps) {
  const query = useEventsKpi(center);
  const fallback = useMemo(() => computeFallbackKpi(recentEvents), [recentEvents]);
  const kpi = query.data ?? fallback;

  return (
    <div className="absolute top-4 left-4 w-64 rounded-md border border-[rgba(160,190,220,.3)] bg-[rgba(11,16,23,.72)] p-3 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold tracking-wider text-[#9DB0C4]">EVENTS KPI · {kpi.window}</span>
        {query.isError ? (
          <span className="rounded bg-[rgba(255,193,120,.18)] px-1 py-0.5 text-[9px] font-bold text-[#FFC978]">표본 집계</span>
        ) : null}
      </div>
      <div className="mt-1 text-sm font-bold">이벤트 관제 KPI</div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Stat label="시간당 피킹 라인" value={kpi.pickingLinesPerHour.toLocaleString()} />
        <Stat label="태스크 평균 소요" value={kpi.avgTaskDurationSec !== null ? `${kpi.avgTaskDurationSec}s` : "—"} />
        <Stat label="리빈 완성/시간" value={kpi.rebinCompletionsPerHour.toLocaleString()} />
        <Stat label="접수" value={kpi.receivingCount.toLocaleString()} />
        <Stat label="출고" value={kpi.shippingCount.toLocaleString()} />
      </div>

      {kpi.pendingTasksByZone.length > 0 ? (
        <div className="mt-2">
          <span className="font-mono text-[10px] font-bold tracking-wider text-[#9DB0C4]">존별 대기 태스크</span>
          <ul className="mt-1 flex flex-col gap-0.5">
            {kpi.pendingTasksByZone.map((z) => (
              <li key={z.zoneCode} className="flex justify-between text-[11px] text-[#DCE5EF]">
                <span className="font-mono font-bold">{z.zoneCode}</span>
                <span>{z.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[rgba(255,255,255,.08)] bg-[rgba(255,255,255,.045)] px-2 py-1">
      <span className="block text-[10px] text-[#6E8398]">{label}</span>
      <b className="font-mono text-sm text-[#E8EDF4]">{value}</b>
    </div>
  );
}

interface FallbackKpi {
  window: string;
  pickingLinesPerHour: number;
  avgTaskDurationSec: number | null;
  pendingTasksByZone: { zoneCode: string; count: number }[];
  rebinCompletionsPerHour: number;
  receivingCount: number;
  shippingCount: number;
}

/** `GET /events/kpi`가 없을 때 최근 버퍼(최대 50건)로 대충 낸 값 — `avgTaskDurationSec`·
 * `pendingTasksByZone`은 `InventoryTxRecorded`만으로 못 내 비워 둔다(서버 집계 필요) */
function computeFallbackKpi(events: WmsEvent[]): FallbackKpi {
  if (events.length === 0) {
    return { window: "표본 없음", pickingLinesPerHour: 0, avgTaskDurationSec: null, pendingTasksByZone: [], rebinCompletionsPerHour: 0, receivingCount: 0, shippingCount: 0 };
  }
  const byType = (type: InventoryTxType) => events.filter((e) => e.payload.txType === type).length;
  const oldest = events[events.length - 1];
  const newest = events[0];
  const spanMin = Math.max(1, (new Date(newest.occurredAt).getTime() - new Date(oldest.occurredAt).getTime()) / 60_000);
  const perHour = (count: number) => Math.round((count / spanMin) * 60);

  return {
    window: `최근 ${Math.round(spanMin)}분 표본`,
    pickingLinesPerHour: perHour(byType("PICK")),
    avgTaskDurationSec: null,
    pendingTasksByZone: [],
    rebinCompletionsPerHour: perHour(byType("REBIN")),
    receivingCount: byType("RECEIVE"),
    shippingCount: byType("SHIP"),
  };
}
