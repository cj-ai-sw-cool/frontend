"use client";

import type { PickTaskPickResponse } from "@/lib/types";
import { Btn, Panel, w98 } from "./win98-ui";

/**
 * 부족 확정 뒤 결과 안내 — 브리프 §3 "응답의 재할당 결과(새 태스크 추가 / 주문 취소) 안내".
 * `onDismiss` 를 눌러야 다음 태스크(또는 배치 완료 화면)로 넘어간다 — 재할당·취소는 되돌릴
 * 수 없는 결과라 확인 없이 그냥 지나가면 놓치기 쉽다.
 */
export function PickOutcomeBanner({
  result,
  onDismiss,
  className = "",
}: {
  result: PickTaskPickResponse;
  onDismiss: () => void;
  className?: string;
}) {
  const reallocation = result.reallocation;
  const discrepancy = result.discrepancy;

  return (
    <Panel title="부족 처리 결과" className={className} bodyClassName="gap-2">
      {discrepancy !== null ? (
        <p className={`${w98.small}`}>
          불일치 신고 접수 — <b className={w98.mono}>{discrepancy.locationCode}</b> 칸 지시{" "}
          <b className={w98.mono}>{discrepancy.expectedQty}</b> / 실제{" "}
          <b className={`${w98.mono} text-[color:var(--status-error)]`}>{discrepancy.foundQty}</b>
        </p>
      ) : null}

      {reallocation !== null ? (
        <div className="flex flex-col gap-1.5">
          {reallocation.newTasks.length > 0 ? (
            <div className={`${w98.sunken} bg-[color:var(--surface-bright)] p-2`}>
              <p className={`${w98.small} font-bold`}>
                부족분 {reallocation.newTasks.length}건 다른 칸으로 재할당됨 — 배치 끝에 태스크가
                추가됩니다.
              </p>
              <ul className={`${w98.small} ${w98.mono} mt-1 flex flex-col gap-0.5`}>
                {reallocation.newTasks.map((task) => (
                  <li key={task.pickTaskId}>
                    #{task.seqNo} {task.locationCode} · {task.qty}개
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {reallocation.cancelledOrders.length > 0 ? (
            <div className={`${w98.sunken} bg-[#ffdad6] p-2`}>
              <p className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
                재할당 실패로 주문 {reallocation.cancelledOrders.length}건이 취소됨(사유
                PICK_SHORT) — 이미 집은 분은 그대로 남습니다.
              </p>
              <ul className={`${w98.small} ${w98.mono} mt-1 flex flex-col gap-0.5`}>
                {reallocation.cancelledOrders.map((order) => (
                  <li key={order.orderId}>{order.receiptNo}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <Btn onClick={onDismiss} className="h-10 text-[15px] font-bold">
        확인 — 다음으로
      </Btn>
    </Panel>
  );
}
