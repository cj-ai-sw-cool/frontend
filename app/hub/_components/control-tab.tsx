"use client";

/**
 * 허브 "관제" 탭 — 브리프 §3 "허브 창 관제 탭: 센터 Select → 그 센터의 KPI + 최근
 * 이벤트 50건 표(시각·유형·로케이션·작업자) + lag. 3D는 넣지 않음(분석 화면으로 링크)".
 *
 * 3D 를 안 그리므로 `useEventStream`·`useEventsKpi`(둘 다 `lib/use-events.ts`)만 쓴다 —
 * `layout` 캐시 갱신·마커 이동 같은 3D 전용 반응(`app/analytics/_data/use-control-mode.ts`)
 * 은 이 탭에 없다.
 */

import { useState } from "react";
import Link from "next/link";
import { centerPath } from "@/lib/center";
import { parseServerInstant } from "@/lib/events-time";
import { useEventStream, useEventsKpi } from "@/lib/use-events";
import { useHubCenters } from "../_data/use-hub";
import { InvariantBadge } from "./invariant-badge";
import { Th, Td } from "./table";
import { Select, Sunken, w98 } from "./win98-ui";
import type { CenterCode } from "@/lib/types";

const DEFAULT_CENTER: CenterCode = "C1";

export function ControlTab() {
  const { data: centers } = useHubCenters();
  const [center, setCenter] = useState<CenterCode>(DEFAULT_CENTER);

  const stream = useEventStream(center);
  const kpi = useEventsKpi(center, "1h", stream.recent);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <Select value={center} onChange={(e) => setCenter(e.target.value as CenterCode)} className="w-48">
          {(centers ?? []).map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.name}
            </option>
          ))}
        </Select>
        <StatusLine connected={stream.connected} usingMock={stream.usingMock} lagMs={stream.lagMs} />
        <InvariantBadge center={center} />
        <Link
          href={centerPath(center, "analytics")}
          className={`${w98.btn} ${w98.raised} ml-auto px-3 py-1 text-[12px] font-bold`}
        >
          3D 관제 열기 →
        </Link>
      </div>

      <div className="grid shrink-0 grid-cols-5 gap-2">
        <Kpi label="시간당 피킹 라인" value={kpi.data?.pickingLinesPerHour} />
        <Kpi label="태스크 평균 소요(초)" value={kpi.data?.avgTaskDurationSec ?? undefined} />
        <Kpi label="리빈 완성/시간" value={kpi.data?.rebinCompletedPerHour} />
        <Kpi label="접수" value={kpi.data?.ordersReceived} />
        <Kpi label="출고" value={kpi.data?.ordersShipped} />
      </div>
      {kpi.usingMock ? (
        <span className="w-fit bg-[color:var(--status-error)] px-1.5 py-0.5 text-[11px] font-bold text-white">
          /events/kpi 미구현 — 최근 이벤트 버퍼로 대충 낸 값(태스크 평균 소요 제외)
        </span>
      ) : null}

      <Sunken className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 bg-[color:var(--surface)]">
            <tr>
              <Th>시각</Th>
              <Th>유형</Th>
              <Th>로케이션</Th>
              <Th>작업자</Th>
            </tr>
          </thead>
          <tbody>
            {stream.recent.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-3 text-center text-[color:var(--muted-foreground)]">
                  이벤트 대기 중…
                </td>
              </tr>
            ) : (
              stream.recent.map((event) => (
                <tr key={event.seq} className="border-b border-[color:var(--border)]">
                  <Td mono>{formatEventTime(event.occurredAt)}</Td>
                  <Td mono>{event.payload.txType ?? event.type}</Td>
                  <Td mono>{event.locationCode ?? event.locationId ?? "—"}</Td>
                  <Td mono>{event.worker ?? "—"}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Sunken>
    </div>
  );
}

function formatEventTime(occurredAt: string): string {
  const ms = parseServerInstant(occurredAt);
  return ms === null ? "—" : new Date(ms).toLocaleTimeString("ko-KR", { hour12: false });
}

function Kpi({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className={`${w98.raised} flex flex-col gap-0.5 bg-[color:var(--surface)] p-2`}>
      <span className={`${w98.mono} text-[16px] font-bold`}>{value !== undefined ? value.toLocaleString() : "—"}</span>
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{label}</span>
    </div>
  );
}

function StatusLine({ connected, usingMock, lagMs }: { connected: boolean; usingMock: boolean; lagMs: number | null }) {
  const label = !connected ? "연결 끊김" : usingMock ? "목 스트림" : "라이브";
  return (
    <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>
      {label}
      {lagMs !== null ? ` · lag ${(lagMs / 1000).toFixed(1)}s` : ""}
    </span>
  );
}
