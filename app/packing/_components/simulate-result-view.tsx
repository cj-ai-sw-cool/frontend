"use client";

import type { Reallocation, SimulateResponse } from "@/lib/types";
import { PICK_BATCH_STATUS_LABEL } from "./wave-detail-panel";
import { PICK_TASK_STATUS_LABEL } from "./pick-task-panel";
import { WAVE_STATUS_LABEL } from "./wave-list-panel";
import { Btn, Etched, Sunken, w98 } from "./win98-ui";

/**
 * 자동 처리 결과 패널 — `wave-batch-simulate-dialog.tsx`가 부름(정본 §7.5 응답, 브리프 §3
 * S7.6 "결과 패널(단계별 행, 취소 주문, 추가 태스크, 배치·웨이브 상태, 소요 ms)").
 */
export function SimulateResultView({
  result,
  onClose,
}: {
  result: SimulateResponse;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-3">
        <div className="grid grid-cols-4 gap-2">
          <ResultStat label="작업자" value={result.worker} />
          <ResultStat label="배치 상태" value={PICK_BATCH_STATUS_LABEL[result.batchStatus]} />
          <ResultStat label="웨이브 상태" value={WAVE_STATUS_LABEL[result.waveStatus]} />
          <ResultStat label="소요" value={`${result.elapsedMs}ms`} />
        </div>

        <Etched />

        <span className={`${w98.small} font-bold`}>단계 ({result.steps.length}건)</span>
        <Sunken className={`${w98.scroll} h-48 overflow-y-auto`}>
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 bg-[color:var(--surface)]">
              <tr>
                <th className="p-1.5">순서</th>
                <th className="p-1.5">칸</th>
                <th className="p-1.5">상품</th>
                <th className="p-1.5 text-right">지시/실제</th>
                <th className="p-1.5">상태</th>
                <th className="p-1.5">재할당 결과</th>
              </tr>
            </thead>
            <tbody>
              {result.steps.map((step) => (
                <tr key={step.pickTaskId} className="border-t border-[color:var(--border)]">
                  <td className={`${w98.mono} p-1.5`}>{step.seqNo}</td>
                  <td className={`${w98.mono} p-1.5 font-bold`}>{step.locationCode}</td>
                  <td className="p-1.5">
                    {step.productName}
                    <span className={`${w98.mono} block text-[11px] text-[color:var(--muted-foreground)]`}>
                      {step.gtin}
                    </span>
                  </td>
                  <td className={`${w98.mono} p-1.5 text-right`}>
                    {step.qty}/{step.pickedQty}
                  </td>
                  <td className="p-1.5">{PICK_TASK_STATUS_LABEL[step.status]}</td>
                  <td className={`${w98.small} p-1.5`}>{reallocationSummary(step.reallocation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sunken>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className={`${w98.small} font-bold`}>
              취소 주문 {result.cancelledOrders.length > 0 ? `(${result.cancelledOrders.length}건)` : "— 없음"}
            </span>
            {result.cancelledOrders.length > 0 ? (
              <Sunken className={`${w98.scroll} h-20 overflow-y-auto p-1`}>
                <ul className="flex flex-col gap-0.5">
                  {result.cancelledOrders.map((order) => (
                    <li key={order.orderId} className={`${w98.small} ${w98.mono}`}>
                      {order.receiptNo}
                    </li>
                  ))}
                </ul>
              </Sunken>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <span className={`${w98.small} font-bold`}>
              추가 태스크 {result.addedTasks.length > 0 ? `(${result.addedTasks.length}건)` : "— 없음"}
            </span>
            {result.addedTasks.length > 0 ? (
              <Sunken className={`${w98.scroll} h-20 overflow-y-auto p-1`}>
                <ul className="flex flex-col gap-0.5">
                  {result.addedTasks.map((task) => (
                    <li key={task.pickTaskId} className={`${w98.small} ${w98.mono}`}>
                      #{task.seqNo} {task.locationCode} · {task.qty}
                    </li>
                  ))}
                </ul>
              </Sunken>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn onClick={onClose} className="h-7 w-24 font-bold">
          닫기
        </Btn>
      </div>
    </>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <Sunken className="flex flex-col items-center gap-0.5 py-1.5">
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{label}</span>
      <span className={`${w98.mono} text-[13px] font-bold`}>{value}</span>
    </Sunken>
  );
}

/** 재할당 결과 한 줄 — 브리프 §3 "재할당 결과 한 줄". PICKED 로 끝난 태스크는 null 이라 빈 줄 */
function reallocationSummary(reallocation: Reallocation | null): string {
  if (reallocation === null) return "—";
  const { outcome, newTasks, cancelledOrders } = reallocation;
  if (outcome === "NEW_TASK") return `다른 칸으로 재할당 (새 태스크 ${newTasks.length}건)`;
  if (outcome === "ORDER_CANCELLED") return `재할당 실패 — 주문 ${cancelledOrders.length}건 취소`;
  return `일부 재할당 (${newTasks.length}건) · 일부 주문 취소 (${cancelledOrders.length}건)`;
}
