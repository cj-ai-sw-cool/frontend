"use client";

/**
 * KPI 패널 — 브리프 §3 "KPI 패널(3D 좌측 대시보드 자리 재사용): `GET /events/kpi`".
 * 관제 모드가 켜지면 `warehouse-slot-3d.tsx`가 기존 점유율 대시보드 대신 이 패널을
 * 그 자리에 올린다. `GET /events/kpi`가 아직 없으면(백엔드 작업 중) `useEventsKpi`가
 * 최근 이벤트 버퍼로 대충 계산한 값을 대신 준다(`lib/use-events.ts`
 * `estimateKpiFromEvents`) — 정확한 서버 집계가 아니라는 뜻으로 배지를 단다.
 */

import { useEventsKpi } from "@/lib/use-events";
import type { WmsEvent } from "@/lib/types";

interface KpiPanelProps {
  center: string;
  recentEvents: WmsEvent[];
}

export function KpiPanel({ center, recentEvents }: KpiPanelProps) {
  const { data: kpi, usingMock } = useEventsKpi(center, "1h", recentEvents);

  return (
    <div className="absolute top-4 left-4 w-64 rounded-md border border-[rgba(160,190,220,.3)] bg-[rgba(11,16,23,.72)] p-3 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold tracking-wider text-[#9DB0C4]">EVENTS KPI · {kpi?.window ?? "…"}</span>
        {usingMock ? (
          <span className="rounded bg-[rgba(255,193,120,.18)] px-1 py-0.5 text-[9px] font-bold text-[#FFC978]">표본 집계</span>
        ) : null}
      </div>
      <div className="mt-1 text-sm font-bold">이벤트 관제 KPI</div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Stat label="시간당 피킹 라인" value={kpi?.pickingLinesPerHour.toLocaleString() ?? "—"} />
        <Stat label="태스크 평균 소요" value={kpi?.avgTaskDurationSec !== null && kpi?.avgTaskDurationSec !== undefined ? `${kpi.avgTaskDurationSec.toFixed(1)}s` : "—"} />
        <Stat label="리빈 완성/시간" value={kpi?.rebinCompletedPerHour.toLocaleString() ?? "—"} />
        <Stat label="접수" value={kpi?.ordersReceived.toLocaleString() ?? "—"} />
        <Stat label="출고" value={kpi?.ordersShipped.toLocaleString() ?? "—"} />
      </div>

      {kpi && kpi.pendingTasksByZone.length > 0 ? (
        <div className="mt-2">
          <span className="font-mono text-[10px] font-bold tracking-wider text-[#9DB0C4]">존별 대기 태스크</span>
          <ul className="mt-1 flex flex-col gap-0.5">
            {kpi.pendingTasksByZone.map((z) => (
              <li key={z.zone} className="flex justify-between text-[11px] text-[#DCE5EF]">
                <span className="font-mono font-bold">{z.zone}</span>
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
