"use client";

/**
 * 시나리오 패널의 진행 띠 — `simulation-scenario-panel.tsx`에서 뺐다(파일 300줄 상한).
 */

import type { useSimulationRunProgress } from "../_data/use-simulation";
import { RUN_STATUS_LABEL } from "./simulation-labels";
import { Sunken, w98 } from "./win98-ui";

export function ProgressBar({
  progress,
  batch,
}: {
  progress: ReturnType<typeof useSimulationRunProgress>["data"];
  /** 선택된 실행이 속한 반복 실행 묶음(§17.8) — 있으면 "묶음 N/M" 배지를 더 보여준다.
   * `count`는 지금까지 만들어진 실행 수, `size`는 사용자가 요청한 반복 횟수(모르면
   * `count`로 대체). */
  batch: { batchId: number; size: number; count: number } | null;
}) {
  if (!progress) {
    return <Sunken className="shrink-0 px-3 py-2"><span className={`${w98.small} text-[color:var(--muted-foreground)]`}>진행 불러오는 중…</span></Sunken>;
  }
  return (
    <Sunken className={`${w98.mono} flex shrink-0 items-center gap-4 px-3 py-2 text-[12px]`}>
      {batch ? <span className="font-bold">묶음 {batch.count}/{batch.size}</span> : null}
      <span className="font-bold">{RUN_STATUS_LABEL[progress.status]}</span>
      <span>가상 시각 {progress.virtualHours.toFixed(1)}h</span>
      <span>진행 {progress.progressPct.toFixed(1)}%</span>
      <span>유입 {progress.ordersReceived.toLocaleString()}</span>
      <span>출고 {progress.ordersShipped.toLocaleString()}</span>
      <span>유휴 토트 {progress.idleTotes?.toLocaleString() ?? "—"}</span>
      <span>포장대 가동 {progress.busyPackStations}</span>
      <span>{progress.eventsPerSec}건/s</span>
    </Sunken>
  );
}
