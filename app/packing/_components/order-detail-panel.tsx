"use client";

import type { AllocationStage, AllocationStatus, OrderDetail } from "@/lib/types";
import { ORDER_STATUS_LABEL } from "./order-list-panel";
import { Btn, Panel, Sunken, w98 } from "./win98-ui";

const STAGE_LABEL: Record<AllocationStage, string> = { SOFT: "SOFT", HARD: "HARD" };
const ALLOC_STATUS_LABEL: Record<AllocationStatus, string> = {
  ACTIVE: "활성",
  CONSUMED: "소진",
  CANCELLED: "취소",
};

/**
 * 가운데 열 — 주문 상세 (브리프 §3 S5.4 "상세(품목·할당 stage/status, 배송단위, 토트),
 * 취소 버튼(허용 상태에서만)").
 *
 * 할당은 품목 한 줄에 여러 개 붙을 수 있다(취소했다 다시 접수하면 CANCELLED 행이 남는다,
 * 정본 §5.2 유니크 인덱스가 "active soft 하나"만 보장한다) — 그래서 품목 아래 할당을
 * 중첩 목록으로 그린다. ⚠️ 서버 응답은 `allocations` 를 품목과 **나란한 최상위 배열**로
 * 준다(2026-09-11 라이브 검증, `lib/types.ts` 의 `OrderAllocation` 주석 참고) — 여기서
 * `orderItemId` 로 묶어서 그린다.
 *
 * 배송단위는 T6(정본 §5.6, Stage 5 한정) — hard 할당 이전이라 접수 시점에 이미 만들어져
 * 있다. Stage 6 에서 이 자리가 hard 할당 뒤로 옮겨간다. 토트는 `toteCode` 문자열로 온다
 * (라이브 검증 — 계약 초안의 `tote: {toteId, barcode}` 중첩이 아니다).
 */
export function OrderDetailPanel({
  order,
  isLoading,
  errorMessage,
  isCancellable,
  onCancel,
  isCancelling,
  cancelErrorMessage,
  className = "",
}: {
  order: OrderDetail | null;
  isLoading: boolean;
  errorMessage: string | null;
  isCancellable: boolean;
  onCancel: () => void;
  isCancelling: boolean;
  cancelErrorMessage: string | null;
  className?: string;
}) {
  return (
    <Panel
      title="주문 상세"
      right={
        order !== null ? (
          <Btn
            onClick={onCancel}
            disabled={!isCancellable || isCancelling}
            title={isCancellable ? "이 주문을 취소합니다" : "RECEIVED·ALLOCATED 상태에서만 취소할 수 있습니다"}
            className="h-6 shrink-0 px-2 text-[12px] font-bold"
          >
            {isCancelling ? "취소 중…" : "주문 취소"}
          </Btn>
        ) : null
      }
      className={`min-h-0 flex-1 ${className}`}
      bodyClassName="min-h-0 gap-2"
    >
      {order === null ? (
        <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>
          {isLoading ? "불러오는 중…" : errorMessage ?? "왼쪽 목록에서 주문을 고르세요."}
        </p>
      ) : (
        <>
          <div className={`${w98.small} grid shrink-0 grid-cols-2 gap-x-3 gap-y-0.5`}>
            <span>
              화주 <b className={w98.mono}>{order.seller.code}</b> · {order.seller.name}
            </span>
            <span>
              상태{" "}
              <b className="text-[color:var(--primary)]">{ORDER_STATUS_LABEL[order.status]}</b>
            </span>
            <span>
              지역 <b className={w98.mono}>{order.regionCode}</b>
            </span>
            <span>
              주문시각 <b className={w98.mono}>{order.orderedAt.slice(0, 16).replace("T", " ")}</b>
            </span>
            <span>
              마감시각{" "}
              <b className={w98.mono}>
                {order.cutoffAt !== null ? order.cutoffAt.slice(0, 16).replace("T", " ") : "—"}
              </b>
            </span>
            <span>
              취소시각{" "}
              <b className={w98.mono}>
                {order.cancelledAt !== null ? order.cancelledAt.slice(0, 16).replace("T", " ") : "—"}
              </b>
            </span>
          </div>

          {cancelErrorMessage !== null ? (
            <p className={`${w98.small} shrink-0 font-bold text-[color:var(--status-error)]`}>
              취소 실패 — {cancelErrorMessage}
            </p>
          ) : null}

          <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
            <table className="w-full border-collapse text-left text-[12px]">
              <thead className="sticky top-0 bg-[color:var(--surface)]">
                <tr>
                  <th className="p-1.5">품목</th>
                  <th className="p-1.5">GTIN</th>
                  <th className="p-1.5 text-right">수량</th>
                  <th className="p-1.5">할당</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => {
                  const allocations = order.allocations.filter(
                    (alloc) => alloc.orderItemId === item.orderItemId,
                  );
                  return (
                    <tr key={item.orderItemId} className="border-t border-[color:var(--border)] align-top">
                      <td className="p-1.5">{item.name}</td>
                      <td className={`${w98.mono} p-1.5`}>{item.gtin}</td>
                      <td className={`${w98.mono} p-1.5 text-right`}>{item.qty}</td>
                      <td className="p-1.5">
                        {allocations.length === 0 ? (
                          <span className="text-[color:var(--muted-foreground)]">없음</span>
                        ) : (
                          <ul className="flex flex-col gap-0.5">
                            {allocations.map((alloc) => (
                              <li key={alloc.allocationId} className={w98.mono}>
                                {STAGE_LABEL[alloc.stage]} · {ALLOC_STATUS_LABEL[alloc.status]} ·{" "}
                                {alloc.qty}
                                {alloc.locationCode != null ? ` · ${alloc.locationCode}` : ""}
                                {alloc.lotNo != null ? ` · ${alloc.lotNo}` : ""}
                                {alloc.expiresOn != null ? ` · ~${alloc.expiresOn}` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Sunken>

          <Sunken className={`${w98.scroll} h-24 shrink-0 overflow-y-auto`}>
            <table className="w-full border-collapse text-left text-[12px]">
              <thead className="sticky top-0 bg-[color:var(--surface)]">
                <tr>
                  <th className="p-1.5">배송단위</th>
                  <th className="p-1.5">상태</th>
                  <th className="p-1.5">토트</th>
                </tr>
              </thead>
              <tbody>
                {order.shipments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-1.5 text-[color:var(--muted-foreground)]">
                      아직 배송단위가 없습니다.
                    </td>
                  </tr>
                ) : (
                  order.shipments.map((shipment) => (
                    <tr key={shipment.shipmentId} className="border-t border-[color:var(--border)]">
                      <td className={`${w98.mono} p-1.5`}>#{shipment.seqNo}</td>
                      <td className="p-1.5">{shipment.status}</td>
                      <td className={`${w98.mono} p-1.5`}>{shipment.toteCode ?? "미배정"}</td>
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
