"use client";

/**
 * 중단 — 자원 점유 선(유휴 토트·포장대·피커·리빈, 정본 §16.6). `simulation-timeline-chart.tsx`
 * 와 같은 SVG 꺾은선 좌표 계산을 그대로 재사용한다(`toPoints`).
 */

import type { SimulationTimelineResponse } from "@/lib/types";
import { CHART_H, CHART_W, Legend, toPoints } from "./simulation-timeline-chart";
import { Sunken, w98 } from "./win98-ui";

const SERIES: { key: keyof Pick<
  SimulationTimelineResponse["buckets"][number],
  "idleTotesPct" | "packStationOccupancyPct" | "pickerOccupancyPct" | "rebinnerOccupancyPct"
>; label: string; color: string }[] = [
  { key: "idleTotesPct", label: "유휴 토트 %", color: "#3D9E7A" },
  { key: "packStationOccupancyPct", label: "포장대 가동 %", color: "#D98A3D" },
  { key: "pickerOccupancyPct", label: "피커 가동 %", color: "#3D6FA3" },
  { key: "rebinnerOccupancyPct", label: "리빈 가동 %", color: "#9457C9" },
];

export function SimulationOccupancyChart({ data }: { data: SimulationTimelineResponse | undefined }) {
  if (!data) {
    return <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>자원 점유 불러오는 중…</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-4">
        <span className={`${w98.small} font-bold`}>자원 점유 — 24시간</span>
        {SERIES.map((s) => (
          <Legend key={s.key} swatch={s.color} label={s.label} />
        ))}
      </div>
      <Sunken className="p-1.5">
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" role="img" aria-label="자원 점유 추이">
          {SERIES.map((s) => (
            <polyline
              key={s.key}
              points={toPoints(data.buckets.map((b) => b[s.key]), 100)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
            />
          ))}
        </svg>
      </Sunken>
    </div>
  );
}
