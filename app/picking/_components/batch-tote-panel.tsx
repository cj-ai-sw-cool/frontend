"use client";

import type { PickBatchDetail } from "@/lib/types";
import { Btn, Panel, Sunken, w98 } from "./win98-ui";

/**
 * claim 직후 — 배치 토트 코드 표시(브리프 §3 "claim → 배치 토트 코드 표시"). "피킹 시작"을
 * 눌러야 `POST /pick-batches/{id}/start` 가 나가고 첫 태스크 카드로 넘어간다(정본 §7.3
 * "CLAIMED → PICKING(첫 태스크 화면 진입)").
 */
export function BatchTotePanel({
  batch,
  onStart,
  isStarting,
  className = "",
}: {
  batch: PickBatchDetail;
  onStart: () => void;
  isStarting: boolean;
  className?: string;
}) {
  return (
    <Panel
      title="배치 확보됨"
      right={
        <span className={`${w98.small} shrink-0 text-[color:var(--muted-foreground)]`}>
          {batch.waveNo} · #{batch.seqNo}
        </span>
      }
      className={className}
      bodyClassName="items-center gap-4 py-4"
    >
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>배치 토트</span>
      <Sunken className="flex w-full items-center justify-center px-4 py-6">
        <span className={`${w98.mono} text-[40px] leading-none font-bold tracking-wider`}>
          {batch.toteLocationCode ?? "배정 중…"}
        </span>
      </Sunken>
      <p className={`${w98.small} text-center text-[color:var(--muted-foreground)]`}>
        이 토트를 들고 칸 순서대로 돌며 담습니다. 총 태스크 {batch.tasks.length}건.
      </p>
      <Btn
        onClick={onStart}
        disabled={isStarting || batch.toteLocationCode === null}
        className="h-11 w-full text-[16px] font-bold"
      >
        {isStarting ? "시작하는 중…" : "피킹 시작"}
      </Btn>
    </Panel>
  );
}
