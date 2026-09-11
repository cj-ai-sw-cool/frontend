"use client";

import type { PickBatchStatus, WaveDetail } from "@/lib/types";
import { ORDER_STATUS_LABEL } from "./order-list-panel";
import { WAVE_STATUS_LABEL } from "./wave-list-panel";
import { Panel, Sunken, w98 } from "./win98-ui";

/** 배치 상태 → 화면 표기 — 정본 §6.3. RELEASED 시점은 전부 OPEN(정본 §6.4-3) */
export const PICK_BATCH_STATUS_LABEL: Record<PickBatchStatus, string> = {
  OPEN: "대기",
  CLAIMED: "배정됨",
  PICKING: "피킹중",
  DONE: "완료",
};

/**
 * 가운데 열 — 웨이브 상세 (브리프 §3 S6.5 "상세(주문 목록·배치 목록·skipped)").
 *
 * 주문 상세(`order-detail-panel.tsx`)와 같은 골격 — 위 메타 그리드 + 아래 두 표. 배치 행을
 * 클릭하면 오른쪽 열(`pick-task-panel.tsx`)이 그 배치의 피킹 지시로 바뀐다(정본 §6.7
 * "배치 클릭 시 피킹 지시 표").
 */
export function WaveDetailPanel({
  wave,
  isLoading,
  errorMessage,
  selectedBatchId,
  onSelectBatch,
  className = "",
}: {
  wave: WaveDetail | null;
  isLoading: boolean;
  errorMessage: string | null;
  selectedBatchId: number | null;
  onSelectBatch: (id: number) => void;
  className?: string;
}) {
  return (
    <Panel
      title="웨이브 상세"
      className={`min-h-0 flex-1 ${className}`}
      bodyClassName="min-h-0 gap-2"
    >
      {wave === null ? (
        <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>
          {isLoading ? "불러오는 중…" : errorMessage ?? "왼쪽 목록에서 웨이브를 고르세요."}
        </p>
      ) : (
        <>
          <div className={`${w98.small} grid shrink-0 grid-cols-2 gap-x-3 gap-y-0.5`}>
            <span>
              웨이브 <b className={w98.mono}>{wave.waveNo}</b>
            </span>
            <span>
              상태 <b className="text-[color:var(--primary)]">{WAVE_STATUS_LABEL[wave.status]}</b>
            </span>
            <span>
              마감시각 <b className={w98.mono}>{wave.cutoffAt.slice(0, 16).replace("T", " ")}</b>
            </span>
            <span>
              주문 수 <b className={w98.mono}>{wave.orderCount}</b>
            </span>
            <span>
              생성시각 <b className={w98.mono}>{wave.createdAt.slice(0, 16).replace("T", " ")}</b>
            </span>
          </div>

          <span className={`${w98.small} shrink-0 font-bold`}>주문</span>
          <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
            <table className="w-full border-collapse text-left text-[12px]">
              <thead className="sticky top-0 bg-[color:var(--surface)]">
                <tr>
                  <th className="p-1.5">수령번호</th>
                  <th className="p-1.5">화주</th>
                  <th className="p-1.5">상태</th>
                </tr>
              </thead>
              <tbody>
                {wave.orders.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-1.5 text-[color:var(--muted-foreground)]">
                      주문이 없습니다.
                    </td>
                  </tr>
                ) : (
                  wave.orders.map((order) => (
                    <tr key={order.orderId} className="border-t border-[color:var(--border)]">
                      <td className={`${w98.mono} p-1.5`}>{order.receiptNo}</td>
                      <td className={`${w98.mono} p-1.5`}>{order.sellerCode}</td>
                      <td className="p-1.5">{ORDER_STATUS_LABEL[order.status]}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Sunken>

          <span className={`${w98.small} shrink-0 font-bold`}>
            배치 — 클릭하면 오른쪽에 피킹 지시가 뜹니다
          </span>
          <Sunken className={`${w98.scroll} h-28 shrink-0 overflow-y-auto`}>
            <table className="w-full border-collapse text-left text-[12px]">
              <thead className="sticky top-0 bg-[color:var(--surface)]">
                <tr>
                  <th className="p-1.5">#</th>
                  <th className="p-1.5">상태</th>
                  <th className="p-1.5">담당</th>
                  <th className="p-1.5 text-right">진행</th>
                  <th className="p-1.5 text-right">주문 수</th>
                </tr>
              </thead>
              <tbody>
                {wave.batches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-1.5 text-[color:var(--muted-foreground)]">
                      배치가 없습니다.
                    </td>
                  </tr>
                ) : (
                  wave.batches.map((batch) => (
                    <tr
                      key={batch.pickBatchId}
                      onClick={() => onSelectBatch(batch.pickBatchId)}
                      aria-current={selectedBatchId === batch.pickBatchId ? "true" : undefined}
                      className={`cursor-pointer border-t border-[color:var(--border)] ${
                        selectedBatchId === batch.pickBatchId
                          ? "bg-[color:var(--surface-variant)]"
                          : ""
                      }`}
                    >
                      <td className={`${w98.mono} p-1.5`}>#{batch.seqNo}</td>
                      <td className="p-1.5">{PICK_BATCH_STATUS_LABEL[batch.status]}</td>
                      <td className={`${w98.mono} p-1.5`}>{batch.claimedBy ?? "—"}</td>
                      {/* pickedTaskCount 는 옵셔널이다(lib/types.ts WaveBatchSummary 주석) —
                          안 오면 taskCount 만 보여주고 진행 분자는 "—"로 남긴다 */}
                      <td className={`${w98.mono} p-1.5 text-right`}>
                        {batch.pickedTaskCount ?? "—"}/{batch.taskCount}
                      </td>
                      <td className={`${w98.mono} p-1.5 text-right`}>{batch.orderCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Sunken>

          {/* ⚠️ 백엔드 2026-09-11 보고 — 이 목록은 항상 비어 있다(§6.3 스키마에 skipped
              저장 표가 없어 GET 이 못 채운다). skipped 는 웨이브 생성 결과(`wave-create-
              dialog.tsx`)에서만 실제로 채워진다 — `lib/types.ts` `WaveDetail.skipped` 주석,
              사용자 보고 "의사결정 필요 사항" 참고. 그래도 필드는 계약대로 두고, 나중에
              백엔드가 저장하게 되면 이 화면이 따로 손볼 것 없이 그대로 채워진다. */}
          {wave.skipped.length > 0 ? (
            <>
              <span className={`${w98.small} shrink-0 font-bold text-[color:var(--status-error)]`}>
                skipped ({wave.skipped.length}건)
              </span>
              <Sunken className={`${w98.scroll} h-16 shrink-0 overflow-y-auto p-1`}>
                <ul className="flex flex-col gap-0.5">
                  {wave.skipped.map((skipped, index) => (
                    <li key={index} className={`${w98.small} ${w98.mono}`}>
                      {skipped.receiptNo} · {skipped.reason}
                    </li>
                  ))}
                </ul>
              </Sunken>
            </>
          ) : null}
        </>
      )}
    </Panel>
  );
}
