"use client";

import type { PickBatchDetail } from "@/lib/types";
import { Btn, Panel, Sunken, w98 } from "./win98-ui";

/**
 * 배치의 마지막 자리 — 두 상태를 하나로 묶는다(브리프 §3 "마지막 → 배치 완료").
 *   대기: 남은 PENDING 태스크가 없지만 아직 `POST .../complete` 를 안 보낸 상태 →
 *         "배치 완료" 버튼
 *   완료: `complete` 응답으로 `status === "DONE"` → 다음 배치로 넘어가는 버튼
 */
export function BatchCompletePanel({
  batch,
  onComplete,
  isCompleting,
  onNextBatch,
  className = "",
}: {
  batch: PickBatchDetail;
  onComplete: () => void;
  isCompleting: boolean;
  onNextBatch: () => void;
  className?: string;
}) {
  const picked = batch.tasks.filter((task) => task.status === "PICKED").length;
  const short = batch.tasks.filter((task) => task.status === "SHORT").length;
  const cancelled = batch.tasks.filter((task) => task.status === "CANCELLED").length;
  const isDone = batch.status === "DONE";

  return (
    <Panel
      title={isDone ? "배치 완료" : "모든 태스크 처리됨"}
      right={
        <span className={`${w98.small} shrink-0 text-[color:var(--muted-foreground)]`}>
          {batch.waveNo} · #{batch.seqNo}
        </span>
      }
      className={className}
      bodyClassName="gap-3"
    >
      <Sunken className="grid grid-cols-3 gap-px bg-[color:var(--border)] p-px">
        <Stat label="완료" value={picked} />
        <Stat label="부족" value={short} tone={short > 0 ? "error" : "normal"} />
        <Stat label="취소" value={cancelled} tone={cancelled > 0 ? "error" : "normal"} />
      </Sunken>

      {isDone ? (
        <>
          <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
            배치가 완료되어 해당 주문이 리비닝(REBINNING) 단계로 넘어갔습니다.
          </p>
          <Btn onClick={onNextBatch} className="h-11 text-[16px] font-bold">
            다음 배치 받기
          </Btn>
        </>
      ) : (
        <Btn
          onClick={onComplete}
          disabled={isCompleting}
          className="h-11 text-[16px] font-bold"
        >
          {isCompleting ? "완료 처리 중…" : "배치 완료"}
        </Btn>
      )}
    </Panel>
  );
}

function Stat({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: number;
  tone?: "normal" | "error";
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-[color:var(--surface-bright)] py-2">
      <span
        className={`${w98.mono} text-[22px] font-bold ${
          tone === "error" && value > 0 ? "text-[color:var(--status-error)]" : ""
        }`}
      >
        {value}
      </span>
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{label}</span>
    </div>
  );
}
