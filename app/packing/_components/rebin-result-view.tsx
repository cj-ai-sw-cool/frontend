"use client";

import type { RebinSimulateResponse } from "@/lib/types";
import { Btn, Etched, Sunken, w98 } from "./win98-ui";

/**
 * 리빈 자동 처리 결과 — `rebin-simulate-dialog.tsx`가 부름(정본 §8.3 응답, 브리프 §3 S8.3
 * "결과 패널(스캔 행: 슬롯·수령번호·상품·수량, 완성 주문, 반납 목록, 소요 ms)").
 *
 * `result.scans[]`(정본 §8.3 "scans:[…]")는 상품 하나를 스캔한 단위이고, 그 안의 `moves[]`
 * 는 그 스캔이 실제로 나뉘어 들어간 슬롯들이다(§8.3 "qty만큼(한 주문이 다 못 받으면 나머지는
 * 다음 주문)") — 표는 move 하나당 한 줄로 펼쳐서 보여준다.
 */
export function RebinResultView({
  result,
  onClose,
}: {
  result: RebinSimulateResponse;
  onClose: () => void;
}) {
  const rows = result.scans.flatMap((scan, scanIndex) =>
    scan.moves.map((move, moveIndex) => ({
      key: `${scanIndex}-${moveIndex}`,
      gtin: scan.gtin,
      productName: scan.productName,
      slotCode: move.slotCode,
      receiptNo: move.receiptNo,
      qty: move.qty,
    })),
  );

  return (
    <>
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-3">
        <div className="grid grid-cols-3 gap-2">
          <ResultStat label="세션" value={`#${result.sessionId}`} />
          <ResultStat label="완성 주문" value={`${result.completedOrders.length}건`} />
          <ResultStat label="소요" value={`${result.elapsedMs}ms`} />
        </div>

        <Etched />

        <span className={`${w98.small} font-bold`}>스캔 ({rows.length}건)</span>
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-1.5 text-[color:var(--muted-foreground)]">
                    스캔 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key} className="border-t border-[color:var(--border)]">
                    <td className={`${w98.mono} p-1.5 font-bold`}>{row.slotCode}</td>
                    <td className={`${w98.mono} p-1.5`}>{row.receiptNo}</td>
                    <td className="p-1.5">
                      {row.productName}
                      <span className={`${w98.mono} block text-[11px] text-[color:var(--muted-foreground)]`}>
                        {row.gtin}
                      </span>
                    </td>
                    <td className={`${w98.mono} p-1.5 text-right`}>{row.qty}</td>
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
                      {row.gtin} · {row.lotNo} · {row.qty}
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
