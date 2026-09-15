"use client";

/**
 * 중단 — 시간대별 유입 vs 출고 선(정본 §16.6). `monthly-panel.tsx` 와 같은 인라인 SVG
 * 꺾은선 관례 — 라이브러리 없이 `<polyline>` 하나로 그린다.
 */

import type { SimulationTimelineResponse } from "@/lib/types";
import { Sunken, w98 } from "./win98-ui";

export const CHART_W = 620;
export const CHART_H = 160;
const W = CHART_W;
const H = CHART_H;
const PAD_B = 16;

/** 꺾은선 좌표 문자열 — 자원 점유 선 차트(`simulation-occupancy-chart.tsx`)도 같이 쓴다 */
export function toPoints(values: number[], max: number): string {
  const n = Math.max(1, values.length - 1);
  return values
    .map((v, i) => {
      const x = (i / n) * W;
      const y = H - PAD_B - (max > 0 ? (v / max) * (H - PAD_B) : 0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function SimulationTimelineChart({ data }: { data: SimulationTimelineResponse | undefined }) {
  if (!data) {
    return <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>타임라인 불러오는 중…</p>;
  }

  const received = data.buckets.map((b) => b.ordersReceived);
  const shipped = data.buckets.map((b) => b.ordersShipped);
  const max = Math.max(1, ...received, ...shipped);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-4">
        <span className={`${w98.small} font-bold`}>시간대별 유입 vs 출고 — 24시간</span>
        <Legend swatch="#3D6FA3" label="유입" />
        <Legend swatch="#D98A3D" label="출고" />
      </div>
      <Sunken className="p-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="시간대별 유입 출고">
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={0}
              x2={W}
              y1={(H - PAD_B) * (1 - f)}
              y2={(H - PAD_B) * (1 - f)}
              stroke="var(--border)"
              strokeWidth={1}
            />
          ))}
          <polyline points={toPoints(received, max)} fill="none" stroke="#3D6FA3" strokeWidth={2} />
          <polyline points={toPoints(shipped, max)} fill="none" stroke="#D98A3D" strokeWidth={2} />
          {data.buckets.map((b, i) =>
            i % 4 === 0 ? (
              <text
                key={b.bucketStart}
                x={(i / Math.max(1, data.buckets.length - 1)) * W}
                y={H - 2}
                fontSize={9}
                textAnchor="middle"
                fill="var(--muted-foreground)"
              >
                {b.bucketStart}
              </text>
            ) : null,
          )}
        </svg>
      </Sunken>
    </div>
  );
}

export function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className={`${w98.small} flex items-center gap-1`}>
      <svg width={10} height={10} aria-hidden>
        <rect width={10} height={10} fill={swatch} />
      </svg>
      {label}
    </span>
  );
}
