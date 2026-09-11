"use client";

import type { PickBatchListItem } from "@/lib/types";
import { Btn, Panel, Sunken, w98 } from "./win98-ui";

/**
 * 받을 수 있는 배치 목록 — 브리프 §3 "OPEN 배치 목록(웨이브·seq·태스크 수) → claim".
 * 웨이브 순·seq 순으로 온다(정본 §7.3) — 화면은 서버가 준 순서를 그대로 보여준다.
 */
export function BatchQueuePanel({
  workerCode,
  items,
  isLoading,
  errorMessage,
  onClaim,
  isClaiming,
  claimingBatchId,
  onChangeWorker,
  className = "",
}: {
  workerCode: string;
  items: PickBatchListItem[];
  isLoading: boolean;
  errorMessage: string | null;
  onClaim: (batchId: number) => void;
  isClaiming: boolean;
  claimingBatchId: number | null;
  onChangeWorker: () => void;
  className?: string;
}) {
  return (
    <Panel
      title="받을 배치"
      right={
        <span className={`${w98.small} shrink-0 text-[color:var(--muted-foreground)]`}>
          작업자{" "}
          <b className={`${w98.mono} text-[color:var(--primary)]`}>{workerCode}</b>{" "}
          <button
            type="button"
            onClick={onChangeWorker}
            className="underline decoration-dotted underline-offset-2"
          >
            변경
          </button>
        </span>
      }
      className={className}
      bodyClassName="gap-2"
    >
      {errorMessage !== null ? (
        <p className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
          목록을 불러오지 못했습니다 — {errorMessage}
        </p>
      ) : null}

      <Sunken className={`${w98.scroll} h-[420px] overflow-y-auto`}>
        {isLoading ? (
          <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>
            지금은 받을 수 있는 배치가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col">
            {items.map((item) => (
              <li
                key={item.pickBatchId}
                className="flex items-center justify-between gap-2 border-b border-[color:var(--surface-dim)] px-2 py-2"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className={`${w98.mono} truncate text-[14px] font-bold`}>
                    {item.waveNo} · #{item.seqNo}
                  </span>
                  <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>
                    태스크 {item.taskCount}건 · 주문 {item.orderCount}건
                  </span>
                </div>
                <Btn
                  onClick={() => onClaim(item.pickBatchId)}
                  disabled={isClaiming}
                  className="h-8 shrink-0 px-3 text-[13px] font-bold"
                >
                  {isClaiming && claimingBatchId === item.pickBatchId ? "받는 중…" : "받기"}
                </Btn>
              </li>
            ))}
          </ul>
        )}
      </Sunken>
    </Panel>
  );
}
