"use client";

import type { PickBatchDetail, PickTaskStatus } from "@/lib/types";
import { PICK_BATCH_STATUS_LABEL } from "./wave-detail-panel";
import { Panel, Sunken, w98 } from "./win98-ui";

/** 피킹 태스크 상태 → 화면 표기 — 정본 §6.3. 배치 생성 직후는 전부 PENDING */
const PICK_TASK_STATUS_LABEL: Record<PickTaskStatus, string> = {
  PENDING: "대기",
  PICKED: "완료",
  SHORT: "부족",
};

/**
 * 우측 열 — 피킹 지시 표 (브리프 §3 S6.5 "배치 클릭 → 피킹 지시 표(순서·칸 코드·상품·로트·
 * 유통기한·수량)"). 정본 §6.7 "FEFO 순서 확인 가능" — 행을 `seqNo`(서버가 로케이션 코드
 * 순으로 매긴 값, 정본 §6.4-3) 순서 그대로 그린다. 화면 체크 3번(브리프 §4)이 유통기한이
 * 빠른 로트(같은 상품, 다른 칸)가 먼저 나오는지 이 표로 확인한다.
 */
export function PickTaskPanel({
  batch,
  isLoading,
  errorMessage,
  className = "",
}: {
  batch: PickBatchDetail | null;
  isLoading: boolean;
  errorMessage: string | null;
  className?: string;
}) {
  return (
    <Panel
      title="피킹 지시"
      right={
        batch !== null ? (
          <span className={`${w98.small} shrink-0 text-[color:var(--muted-foreground)]`}>
            배치 #{batch.seqNo} · {PICK_BATCH_STATUS_LABEL[batch.status]}
          </span>
        ) : null
      }
      className={`min-h-0 flex-1 ${className}`}
      bodyClassName="min-h-0 gap-1.5"
    >
      {batch === null ? (
        <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>
          {isLoading ? "불러오는 중…" : errorMessage ?? "가운데 배치 목록에서 배치를 고르세요."}
        </p>
      ) : (
        <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 bg-[color:var(--surface)]">
              <tr>
                <th className="p-1.5">순서</th>
                <th className="p-1.5">칸</th>
                <th className="p-1.5">상품</th>
                <th className="p-1.5">로트</th>
                <th className="p-1.5">유통기한</th>
                <th className="p-1.5 text-right">수량</th>
                <th className="p-1.5">상태</th>
              </tr>
            </thead>
            <tbody>
              {batch.tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-1.5 text-[color:var(--muted-foreground)]">
                    태스크가 없습니다.
                  </td>
                </tr>
              ) : (
                batch.tasks.map((task) => (
                  <tr key={task.pickTaskId} className="border-t border-[color:var(--border)]">
                    <td className={`${w98.mono} p-1.5`}>{task.seqNo}</td>
                    <td className={`${w98.mono} p-1.5 font-bold`}>{task.locationCode}</td>
                    <td className="p-1.5">
                      {task.productName}
                      <span className={`${w98.mono} block text-[11px] text-[color:var(--muted-foreground)]`}>
                        {task.sellerCode} · {task.gtin}
                      </span>
                    </td>
                    <td className={`${w98.mono} p-1.5`}>{task.lotNo}</td>
                    <td className={`${w98.mono} p-1.5`}>{task.expiresOn ?? "—"}</td>
                    <td className={`${w98.mono} p-1.5 text-right`}>{task.qty}</td>
                    <td className="p-1.5">{PICK_TASK_STATUS_LABEL[task.status]}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Sunken>
      )}
    </Panel>
  );
}
