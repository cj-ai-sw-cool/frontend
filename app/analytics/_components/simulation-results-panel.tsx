"use client";

/**
 * 시뮬레이션 탭 중단 — 선택한 실행의 결과(정본 §16.6). 리드타임·타임라인·자원 점유·병목
 * 넷을 각자 파일로 나눴다(파일 300줄 상한).
 */

import { useSimulationBatchLeadtime } from "../_data/use-simulation-batch";
import { useSimulationBottleneck, useSimulationLeadtime, useSimulationTimeline } from "../_data/use-simulation";
import { RESOURCE_LABEL } from "./simulation-labels";
import { SimulationLeadtimeChart } from "./simulation-leadtime-chart";
import { SimulationOccupancyChart } from "./simulation-occupancy-chart";
import { SimulationTimelineChart } from "./simulation-timeline-chart";
import { Sunken, w98 } from "./win98-ui";
import type { SimulationBatchGroup } from "@/lib/types";

export function SimulationResultsPanel({
  runId,
  batch,
}: {
  runId: number | null;
  /** 선택된 실행이 속한 반복 실행 묶음(§17.8) — 있으면 리드타임 막대에 범위 수염을 얹는다 */
  batch: SimulationBatchGroup | null;
}) {
  const leadtime = useSimulationLeadtime(runId);
  const timeline = useSimulationTimeline(runId);
  const bottleneck = useSimulationBottleneck(runId);

  const batchStats = useSimulationBatchLeadtime(batch);
  // 완료된 실행이 2개 이상이어야 "범위"가 뜻이 있다(1개면 최소=최대=평균) — §17.8
  const rangeStats = batch && batchStats.data && batchStats.data.readyRunIds.length >= 2 ? batchStats.data : null;

  if (runId === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
          위 시나리오 목록에서 실행을 고르면 결과가 여기 보입니다.
        </p>
      </div>
    );
  }

  /* gap-2(8px, 3칸 상한 아래 gap-3 보다 촘촘) — `simulation-tab.tsx` 가 이 패널에 주는
   * 높이가 872px 고정 예산(스크롤 없음, `analytics/layout.tsx` 머리말)을 시나리오·비교
   * 패널과 나눠 쓴 나머지라 빠듯하다. `overflow-y-auto` 는 그래도 넘칠 때(비교 패널이
   * 펼쳐져 이 패널이 줄어들 때 등)의 안전망으로 남겨 둔다 — 평소에는 안 쓰인다. */
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <SimulationLeadtimeChart data={leadtime.data} range={rangeStats} />
      <SimulationTimelineChart data={timeline.data} />
      <SimulationOccupancyChart data={timeline.data} />
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
        {bottleneck.label} · 대기 비중 {bottleneck.share.toFixed(1)}% · 최대 대기 {bottleneck.peakWaitSec}초 · 포화{" "}
        {bottleneck.saturated.length > 0 ? bottleneck.saturated.map((r) => RESOURCE_LABEL[r]).join("·") : "없음"}
      </span>
    </Sunken>
  );
}
