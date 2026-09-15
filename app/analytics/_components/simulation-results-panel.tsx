"use client";

/**
 * 시뮬레이션 탭 중단 — 선택한 실행의 결과(정본 §16.6). 리드타임·타임라인·자원 점유·병목
 * 넷을 각자 파일로 나눴다(파일 300줄 상한).
 */

import { useSimulationBottleneck, useSimulationLeadtime, useSimulationTimeline } from "../_data/use-simulation";
import { RESOURCE_LABEL, SEGMENT_LABEL } from "./simulation-labels";
import { SimulationLeadtimeChart } from "./simulation-leadtime-chart";
import { SimulationOccupancyChart } from "./simulation-occupancy-chart";
import { SimulationTimelineChart } from "./simulation-timeline-chart";
import { Sunken, w98 } from "./win98-ui";

export function SimulationResultsPanel({ runId }: { runId: number | null }) {
  const leadtime = useSimulationLeadtime(runId);
  const timeline = useSimulationTimeline(runId);
  const bottleneck = useSimulationBottleneck(runId);

  if (runId === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
          위 시나리오 목록에서 실행을 고르면 결과가 여기 보입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <SimulationLeadtimeChart data={leadtime.data} />
      <div className={w98.etched} />
      <SimulationTimelineChart data={timeline.data} />
      <SimulationOccupancyChart data={timeline.data} />
      <div className={w98.etched} />
      <BottleneckCard bottleneck={bottleneck.data} />
    </div>
  );
}

function BottleneckCard({ bottleneck }: { bottleneck: ReturnType<typeof useSimulationBottleneck>["data"] }) {
  if (!bottleneck) {
    return <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>병목 계산 중…</p>;
  }
  return (
    <Sunken className="flex items-center gap-4 px-3 py-2">
      <span className={`${w98.small} font-bold`}>병목</span>
      <span className={`${w98.mono} text-[13px]`}>
        {SEGMENT_LABEL[bottleneck.segment]} · {bottleneck.bucketStart} · 대기 {bottleneck.waitSec}초 · 포화{" "}
        {RESOURCE_LABEL[bottleneck.saturatedResource]}
      </span>
    </Sunken>
  );
}
