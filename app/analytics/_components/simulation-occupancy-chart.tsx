"use client";

/**
 * 중단 — 자원 점유 선(유휴 토트·포장대·피커·리빈, 정본 §16.6). `simulation-timeline-chart.tsx`
 * 와 같은 SVG 꺾은선 좌표 계산을 그대로 재사용한다(`toPoints`).
 */

import type { SimulationTimelineBucket, SimulationTimelineResponse } from "@/lib/types";
import { CHART_H, CHART_W, Legend, toPoints } from "./simulation-timeline-chart";
import { Sunken, w98 } from "./win98-ui";

/** 라이브 대조: 필드 이름이 `idleTotesPct`·`packStationOccupancyPct` 가 아니라
 * `idleTotes`(토트 수, 0~100 퍼센트가 아니다)·`packStationBusyPct`·`pickerBusyPct`·
 * `rebinBusyPct` 다. `*BusyPct` 는 100을 넘을 수 있다(그 시간에 필요한 처리량 대비
 * 배율로 보인다) — 그래서 100 고정 상한 대신 네 계열 전체에서 최댓값을 구해 같이
 * 쓴다(`simulation-timeline-chart.tsx` 의 유입/출고 선과 같은 방식). */
const SERIES: { key: keyof Pick<SimulationTimelineBucket, "idleTotes" | "packStationBusyPct" | "pickerBusyPct" | "rebinBusyPct">; label: string; color: string }[] = [
  { key: "idleTotes", label: "유휴 토트", color: "#3D9E7A" },
  { key: "packStationBusyPct", label: "포장대 부하", color: "#D98A3D" },
  { key: "pickerBusyPct", label: "피커 부하", color: "#3D6FA3" },
  { key: "rebinBusyPct", label: "리빈 부하", color: "#9457C9" },
];

export function SimulationOccupancyChart({ data }: { data: SimulationTimelineResponse | undefined }) {
  if (!data) {
    return <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>자원 점유 불러오는 중…</p>;
  }

  const max = Math.max(1, ...SERIES.flatMap((s) => data.map((b) => b[s.key])));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-4">
        <span className={`${w98.small} font-bold`}>자원 점유 — 24시간</span>
        {SERIES.map((s) => (
          <Legend key={s.key} swatch={s.color} label={s.label} />
        ))}
      </div>
      {/* 고정 높이 — `simulation-timeline-chart.tsx` 의 같은 주의 참고(viewBox 비율대로
       * 늘리면 872px 고정 예산 안에서 아래 병목 카드가 잘린다) */}
      <Sunken className="h-20 p-1.5">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label="자원 점유 추이"
        >
          {SERIES.map((s) => (
            <polyline
              key={s.key}
              points={toPoints(data.map((b) => b[s.key]), max)}
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
