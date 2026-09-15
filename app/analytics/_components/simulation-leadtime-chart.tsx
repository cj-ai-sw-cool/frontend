"use client";

/**
 * 중단 — 리드타임 분해 누적 막대(정본 §16.6 "구간 9개, 작업/대기 색 구분, p50·p95 토글").
 *
 * ⚠️ 막대는 **인라인 SVG `<rect>`** 로 그린다(`monthly-panel.tsx` 와 같은 관례) — 폭이
 * 구간마다 연속값(%)이라 `slotting-compare-panel.tsx` 의 5% 단위 Tailwind 클래스 배열
 * 트릭(21개 고정 폭)을 9칸 누적에 그대로 쓰면 반올림 오차가 겹겹이 쌓여 막대 합이
 * 100%에서 크게 어긋난다. SVG 속성(`x`/`width`)은 `style` prop 이 아니므로 "inline
 * style 금지" 규칙에 걸리지 않는다.
 */

import { useState } from "react";
import type { SimulationLeadtimeResponse } from "@/lib/types";
import { SEGMENT_COLOR_CLASS, SEGMENT_FILL, segmentKindOf } from "./simulation-labels";
import { Sunken, w98 } from "./win98-ui";

const W = 620;
const H = 28;

type Metric = "p50Sec" | "p95Sec";

export function SimulationLeadtimeChart({ data }: { data: SimulationLeadtimeResponse | undefined }) {
  const [metric, setMetric] = useState<Metric>("p50Sec");

  if (!data) {
    return <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>리드타임 불러오는 중…</p>;
  }

  const total = data.rows.reduce((sum, r) => sum + r[metric], 0) || 1;
  const segments = data.rows.reduce<{ row: (typeof data.rows)[number]; x: number; width: number }[]>(
    (acc, row) => {
      const prevEnd = acc.length > 0 ? acc[acc.length - 1].x + acc[acc.length - 1].width : 0;
      const width = (row[metric] / total) * W;
      acc.push({ row, x: prevEnd, width });
      return acc;
    },
    [],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={`${w98.small} font-bold`}>
          총 리드타임 {metric === "p50Sec" ? data.totalLeadtime.p50Sec : data.totalLeadtime.p95Sec}초 (
          {metric === "p50Sec" ? "p50" : "p95"}) · 주문 {data.totalOrders.toLocaleString()}건
        </span>
        <div className="flex gap-1">
          {(["p50Sec", "p95Sec"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`${w98.btn} ${metric === m ? w98.raisedActive : w98.raised} h-6 px-2 text-[11px]`}
            >
              {m === "p50Sec" ? "p50" : "p95"}
            </button>
          ))}
        </div>
      </div>

      {/* 고정 높이 — `simulation-timeline-chart.tsx` 머리말과 같은 이유(viewBox 비율대로
       * 늘리면 이 화면 폭에서 52px 까지 커져 872px 예산을 갉아먹는다) */}
      <Sunken className="h-8 p-1.5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label="리드타임 구간 누적 막대"
        >
          {segments.map(({ row, x: segX, width }) => (
            <rect
              key={row.segment}
              x={segX}
              y={0}
              width={Math.max(0, width - 1)}
              height={H}
              fill={SEGMENT_FILL[segmentKindOf(row.segment)]}
            >
              <title>
                {row.label} — {row[metric]}초
              </title>
            </rect>
          ))}
        </svg>
      </Sunken>

      <div className="grid grid-cols-3 gap-x-3 gap-y-1">
        {data.rows.map((row) => (
          <div key={row.segment} className={`${w98.small} flex items-center gap-1.5`}>
            <span className={`size-2.5 shrink-0 ${SEGMENT_COLOR_CLASS[segmentKindOf(row.segment)]}`} aria-hidden />
            <span className="flex-1 truncate">{row.label}</span>
            <span className={`${w98.mono} text-[11px]`}>{row[metric]}s</span>
          </div>
        ))}
      </div>
    </div>
  );
}
