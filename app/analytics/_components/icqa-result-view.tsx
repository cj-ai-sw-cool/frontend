"use client";

/**
 * 실사 결과 패널 — `icqa-count-dialog.tsx`의 `result` 단계(정본 §10.3·§10.4).
 *
 * 라인별 전산(expected)·델타·입력(counted)·차이(diff)·조정 원장 id 를 보여준다. 상품명은
 * 제출 응답 라인의 `productName` 을 그대로 쓴다(라이브 대조로 확인, 2026-09-13 — 정본 §10.3
 * 문안엔 없었으나 실제 응답엔 있다). RECOUNT_NEEDED 로 새 태스크가 생겼으면 "재카운트 실사
 * 열기"로 바로 이어서 연다(브리프 §3 "재카운트 태스크는 표에서 바로 열 수 있게").
 */

import type { CountTaskOutcome, SubmitCountTaskResponse } from "@/lib/types";
import { Btn, Etched, Sunken, w98 } from "./win98-ui";

const OUTCOME_LABEL: Record<CountTaskOutcome, string> = {
  ADJUSTED: "조정됨",
  CONFIRMED: "확인됨",
  RECOUNT_NEEDED: "재카운트 필요",
};

export function IcqaResultView({
  result,
  onClose,
  onOpenRecount,
}: {
  result: SubmitCountTaskResponse;
  onClose: () => void;
  onOpenRecount: (recountTaskId: number) => void;
}) {
  return (
    <>
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-3">
        <div className="grid grid-cols-3 gap-2">
          <ResultStat label="결과" value={OUTCOME_LABEL[result.outcome]} />
          <ResultStat label="실사 중 이동" value={result.moved ? "있음" : "없음"} />
          <ResultStat label="라인" value={`${result.lines.length}건`} />
        </div>

        <Etched />

        <span className={`${w98.small} font-bold`}>라인 ({result.lines.length}건)</span>
        <Sunken className={`${w98.scroll} h-48 overflow-y-auto`}>
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 bg-[color:var(--surface)]">
              <tr>
                <th className="p-1.5">상품</th>
                <th className="p-1.5">로트</th>
                <th className="p-1.5 text-right">전산</th>
                <th className="p-1.5 text-right">델타</th>
                <th className="p-1.5 text-right">입력</th>
                <th className="p-1.5 text-right">차이</th>
                <th className="p-1.5">조정 원장</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((line) => (
                <tr key={line.lineId} className="border-t border-[color:var(--border)]">
                  <td className="p-1.5">
                    {line.productName}
                    <span className={`${w98.mono} block text-[11px] text-[color:var(--muted-foreground)]`}>
                      {line.gtin}
                    </span>
                  </td>
                  <td className={`${w98.mono} p-1.5`}>{line.lotNo}</td>
                  <td className={`${w98.mono} p-1.5 text-right`}>{line.expectedQty}</td>
                  <td className={`${w98.mono} p-1.5 text-right`}>{line.deltaQty}</td>
                  <td className={`${w98.mono} p-1.5 text-right`}>{line.countedQty}</td>
                  <td
                    className={`${w98.mono} p-1.5 text-right font-bold ${
                      line.diff !== 0 ? "text-[color:var(--status-error)]" : ""
                    }`}
                  >
                    {line.diff > 0 ? `+${line.diff}` : line.diff}
                  </td>
                  <td className={`${w98.mono} p-1.5`}>{line.adjustTxId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sunken>

        {result.recountTaskId !== null ? (
          <div className={`${w98.sunken} flex items-center justify-between gap-2 bg-[color:var(--surface-bright)] p-2`}>
            <span className={`${w98.small}`}>
              차이가 있는데 실사 중 이동이 있어 조정하지 않았습니다 — 재카운트 태스크 #{result.recountTaskId}
            </span>
            <Btn onClick={() => onOpenRecount(result.recountTaskId as number)} className="h-7 px-3 text-[12px] font-bold">
              재카운트 실사 열기
            </Btn>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className={`${w98.small} font-bold`}>
              재할당 {result.reallocated.length > 0 ? `(${result.reallocated.length}건)` : "— 없음"}
            </span>
            {result.reallocated.length > 0 ? (
              <Sunken className={`${w98.scroll} h-20 overflow-y-auto p-1`}>
                <ul className="flex flex-col gap-0.5">
                  {result.reallocated.map((task) => (
                    <li key={task.pickTaskId} className={`${w98.small} ${w98.mono}`}>
                      {task.locationCode} · {task.qty}
                    </li>
                  ))}
                </ul>
              </Sunken>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <span className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
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
