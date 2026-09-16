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
import type { LeadtimeSegment, SimulationBatchLeadtimeStats, SimulationBatchRange, SimulationLeadtimeResponse } from "@/lib/types";
import { SEGMENT_COLOR_CLASS, SEGMENT_FILL } from "./simulation-labels";
import { Sunken, w98 } from "./win98-ui";

const W = 620;
const H = 28;

type Metric = "p50Sec" | "p95Sec";

export function SimulationLeadtimeChart({
  data,
  range,
}: {
  data: SimulationLeadtimeResponse | undefined;
  /** 반복 실행 묶음의 리드타임 범위(§17.8) — 있으면 총 p50을 "평균 ± 범위"로, 구간마다
   * 범위 수염을 더 보여준다. p50 전용(정본 "baseline 3회 반복의 총 p50 범위") — 있는
   * 동안은 p95 토글을 숨긴다. */
  range: SimulationBatchLeadtimeStats | null;
}) {
  const [metric, setMetric] = useState<Metric>("p50Sec");
  const effectiveMetric: Metric = range ? "p50Sec" : metric;

  if (!data) {
    return <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>리드타임 불러오는 중…</p>;
  }

  const total = data.segments.reduce((sum, r) => sum + r[effectiveMetric], 0) || 1;
  const segments = data.segments.reduce<{ row: (typeof data.segments)[number]; x: number; width: number }[]>(
    (acc, row) => {
      const prevEnd = acc.length > 0 ? acc[acc.length - 1].x + acc[acc.length - 1].width : 0;
      const width = (row[effectiveMetric] / total) * W;
      acc.push({ row, x: prevEnd, width });
      return acc;
    },
    [],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={`${w98.small} font-bold`}>
          {range?.totalP50 ? (
            <>
              총 리드타임 p50 평균 {range.totalP50.avg.toFixed(0)}s (범위 {range.totalP50.min.toFixed(0)}~
              {range.totalP50.max.toFixed(0)}s, {range.totalP50.n}회) ·{" "}
            </>
          ) : (
            <>
              총 리드타임 {effectiveMetric === "p50Sec" ? data.totalLeadtime.p50Sec : data.totalLeadtime.p95Sec}초 (
              {effectiveMetric === "p50Sec" ? "p50" : "p95"}) ·{" "}
            </>
          )}
          출고 {data.orders.shipped.toLocaleString()}건 (완료율 {data.orders.completionPct.toFixed(1)}%)
        </span>
        {range ? null : (
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
        )}
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
              key={row.key}
              x={segX}
              y={0}
              width={Math.max(0, width - 1)}
              height={H}
              fill={SEGMENT_FILL[row.kind]}
            >
              <title>
                {row.label} — {row[effectiveMetric]}초
              </title>
            </rect>
          ))}
        </svg>
      </Sunken>

      <div className="grid grid-cols-3 gap-x-3 gap-y-1">
        {data.segments.map((row) => {
          const segRange = range?.perSegment[row.key as LeadtimeSegment];
          return (
            <div key={row.key} className={`${w98.small} flex items-center gap-1.5`}>
              <span className={`size-2.5 shrink-0 ${SEGMENT_COLOR_CLASS[row.kind]}`} aria-hidden />
              <span className="flex-1 truncate">{row.label}</span>
              {segRange ? <SegmentWhisker r={segRange} /> : null}
              <span className={`${w98.mono} text-[11px]`}>
                {segRange ? `${segRange.avg.toFixed(0)}s (${segRange.min.toFixed(0)}~${segRange.max.toFixed(0)})` : `${row[effectiveMetric]}s`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 구간 하나의 배치 내 범위 수염(§17.8 "구간 막대에 범위 수염") — 이 구간 자신의
 * min~max 로 스케일을 잡는다(구간마다 초 단위가 크게 달라 위 누적 막대의 공용 스케일에
 * 얹으면 짧은 구간의 수염이 안 보인다). 색은 `simulation-labels.ts` 의 기존 팔레트를
 * 재사용 — 새 하드코딩 색을 만들지 않는다. */
function SegmentWhisker({ r }: { r: SimulationBatchRange }) {
  const boxW = 44;
  const h = 10;
  const pad = 3;
  const span = Math.max(1, r.max - r.min);
  const scaleX = (v: number) => pad + ((v - r.min) / span) * (boxW - pad * 2);
  const avgX = scaleX(r.avg);
  return (
    <svg
      viewBox={`0 0 ${boxW} ${h}`}
      className="h-2.5 w-11 shrink-0 text-[color:var(--muted-foreground)]"
      role="img"
      aria-label={`범위 ${r.min.toFixed(0)}~${r.max.toFixed(0)}초, 평균 ${r.avg.toFixed(0)}초`}
    >
      <line x1={pad} y1={h / 2} x2={boxW - pad} y2={h / 2} stroke="currentColor" strokeWidth={1} />
      <line x1={pad} y1={1} x2={pad} y2={h - 1} stroke="currentColor" strokeWidth={1} />
      <line x1={boxW - pad} y1={1} x2={boxW - pad} y2={h - 1} stroke="currentColor" strokeWidth={1} />
      <circle cx={avgX} cy={h / 2} r={1.8} fill={SEGMENT_FILL.WORK} />
    </svg>
  );
}
