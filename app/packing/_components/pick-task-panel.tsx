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
 * 유통기한·수량)"). 행 순서(`seqNo`)는 로케이션 코드 순이지 유통기한 순이 아니다(정본
 * §6.4-3, 백엔드 2026-09-12 라이브 보고로 확인) — 유통기한이 빠른 로트가 놓인 칸이 코드상
 * 뒤일 수 있다(예: 09G 로트가 A-02-*, 09F 로트가 A-01-*). 그래서 FEFO 를 "줄 순서"가 아니라
 * "어느 로트를 골랐는지"로 보여줘야 한다 — 로트·유통기한 열을 강조하고, 표 위에 이 순서가
 * 무엇을 뜻하는지 짧게 적어 둔다.
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
        <>
          <p className={`${w98.small} shrink-0 text-[color:var(--muted-foreground)]`}>
            줄 순서는 칸 코드 순입니다. 같은 상품이 로트별로 나뉘어 있으면 로트·유통기한 열로
            어느 로트를 먼저 썼는지 확인하세요.
          </p>
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
                      {/* 로트·유통기한 — FEFO 는 줄 순서가 아니라 이 두 열이 보여준다(위 안내문) */}
                      <td className={`${w98.mono} p-1.5 font-bold text-[color:var(--primary)]`}>
                        {task.lotNo}
                      </td>
                      <td className={`${w98.mono} p-1.5 font-bold text-[color:var(--primary)]`}>
                        {task.expiresOn ?? "—"}
                      </td>
                      <td className={`${w98.mono} p-1.5 text-right`}>{task.qty}</td>
                      <td className="p-1.5">{PICK_TASK_STATUS_LABEL[task.status]}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Sunken>
        </>
      )}
    </Panel>
  );
}
