"use client";

import type { RebinSimulateResponse } from "@/lib/types";
import { Btn, Etched, Sunken, w98 } from "./win98-ui";

/**
 * 리빈 자동 처리 결과 — `rebin-simulate-dialog.tsx`가 부름(정본 §8.3 응답, 브리프 §3 S8.3
 * "결과 패널(스캔 행: 슬롯·수령번호·상품·수량, 완성 주문, 반납 목록, 소요 ms)").
 *
 * `result.scans[]` 는 이미 이동 단위로 펼쳐진 평평한 행이다(백엔드 조율자 결정 3번,
 * 2026-09-12) — 옮긴 줄은 `slotCode`/`receiptNo`가 채워지고, 옮기지 못한 몫이 있으면
 * `slotCode`/`receiptNo`가 `null`인 별도 줄로 온다(`unmovedQty > 0`). 시뮬레이터는 벽이
 * 기다리는 몫만 골라 읽으므로(§8.1) 실제로는 후자가 거의 나오지 않는다.
 */
export function RebinResultView({
  result,
  onClose,
}: {
  result: RebinSimulateResponse;
  onClose: () => void;
}) {
  const unmovedTotal = result.scans.reduce((sum, scan) => sum + scan.unmovedQty, 0);

  return (
    <>
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-3">
        <div className="grid grid-cols-4 gap-2">
          <ResultStat label="세션" value={`#${result.sessionId}`} />
          <ResultStat label="완성 주문" value={`${result.completedOrders.length}건`} />
          <ResultStat label="옮기지 못함" value={`${unmovedTotal}개`} />
          <ResultStat label="소요" value={`${result.elapsedMs}ms`} />
        </div>

        <Etched />

        <span className={`${w98.small} font-bold`}>스캔 ({result.scans.length}건)</span>
        <Sunken className={`${w98.scroll} h-48 overflow-y-auto`}>
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 bg-[color:var(--surface)]">
              <tr>
                <th className="p-1.5">슬롯</th>
                <th className="p-1.5">수령번호</th>
                <th className="p-1.5">상품</th>
                <th className="p-1.5 text-right">수량</th>
              </tr>
            </thead>
            <tbody>
              {result.scans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-1.5 text-[color:var(--muted-foreground)]">
                    스캔 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                result.scans.map((scan, index) => (
                  <tr key={index} className="border-t border-[color:var(--border)]">
                    <td className={`${w98.mono} p-1.5 font-bold`}>{scan.slotCode ?? "—"}</td>
                    <td className={`${w98.mono} p-1.5`}>{scan.receiptNo ?? "—"}</td>
                    <td className="p-1.5">
                      {scan.productName}
                      <span className={`${w98.mono} block text-[11px] text-[color:var(--muted-foreground)]`}>
                        {scan.gtin}
                      </span>
                    </td>
                    <td className={`${w98.mono} p-1.5 text-right`}>
                      {scan.unmovedQty > 0 ? (
                        <span className="text-[color:var(--status-error)]">
                          옮기지 못함 {scan.unmovedQty}
                        </span>
                      ) : (
                        scan.qty
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Sunken>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className={`${w98.small} font-bold`}>
              완성 주문 {result.completedOrders.length > 0 ? `(${result.completedOrders.length}건)` : "— 없음"}
            </span>
            {result.completedOrders.length > 0 ? (
              <Sunken className={`${w98.scroll} h-20 overflow-y-auto p-1`}>
                <ul className="flex flex-col gap-0.5">
                  {result.completedOrders.map((receiptNo) => (
                    <li key={receiptNo} className={`${w98.small} ${w98.mono}`}>
                      {receiptNo}
                    </li>
                  ))}
                </ul>
              </Sunken>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <span className={`${w98.small} font-bold`}>
              반납 {result.restocked.length > 0 ? `(${result.restocked.length}건)` : "— 없음"}
            </span>
            {result.restocked.length > 0 ? (
              <Sunken className={`${w98.scroll} h-20 overflow-y-auto p-1`}>
                <ul className="flex flex-col gap-0.5">
                  {result.restocked.map((row, index) => (
                    <li key={index} className={`${w98.small} ${w98.mono}`}>
                      {row.productName} · {row.lotNo} · {row.qty}
                    </li>
                  ))}
                </ul>
              </Sunken>
            ) : null}
          </div>
        </div>

        {/* 정상 완주(force 없이 종료)면 항상 비어 있다 — 미완성 슬롯을 force 로 취소한
            경로에서만 채워진다(정본 §8.3 문안에는 없고 백엔드 라이브 보고로 추가, `lib/types.ts`
            `RebinSimulateResponse.cancelledOrders` 주석 참고). 있을 때만 자리를 차지한다 */}
        {result.cancelledOrders !== undefined && result.cancelledOrders.length > 0 ? (
          <div className="flex flex-col gap-1">
            <span className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
              취소 주문 ({result.cancelledOrders.length}건)
            </span>
            <Sunken className={`${w98.scroll} h-16 overflow-y-auto p-1`}>
              <ul className="flex flex-col gap-0.5">
                {result.cancelledOrders.map((order) => (
                  <li key={order.orderId} className={`${w98.small} ${w98.mono}`}>
                    {order.receiptNo}
                  </li>
                ))}
              </ul>
            </Sunken>
          </div>
        ) : null}
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
