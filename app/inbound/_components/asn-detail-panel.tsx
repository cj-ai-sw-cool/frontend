"use client";

import type { AsnDetail } from "@/lib/types";
import { ASN_STATUS_LABEL } from "./asn-list-panel";
import { Btn, Etched, Panel, Sunken, w98 } from "./win98-ui";

/**
 * 좌측 열 — 선택한 ASN의 상세 (정본 §3.6): 상태, 도착 처리 버튼, 품목 표(예정/수령 누계/
 * 파손/미달), receipt 목록, 부분수령이면 마감 버튼.
 *
 * "검수 완료"(receipt 완료) 버튼도 여기에 둔다 — receipt 목록·마감과 같은 "ASN 지금 상태를
 * 바꾸는 동작"이라 이 칸에 모으는 편이 우측 열(스캔·검수 입력)과 역할이 갈린다.
 */
export function AsnDetailPanel({
  detail,
  isLoading,
  onArrive,
  isArriving,
  onCompleteReceipt,
  isCompletingReceipt,
  onClose,
  isClosing,
}: {
  detail?: AsnDetail;
  isLoading: boolean;
  onArrive: () => void;
  isArriving: boolean;
  onCompleteReceipt: () => void;
  isCompletingReceipt: boolean;
  onClose: () => void;
  isClosing: boolean;
}) {
  const openReceipt = detail?.receipts.find((r) => r.status === "OPEN") ?? null;
  const canArrive =
    detail !== undefined && (detail.status === "REGISTERED" || detail.status === "PARTIALLY_RECEIVED");
  const canClose = detail !== undefined && detail.status === "PARTIALLY_RECEIVED";

  return (
    <Panel title="ASN 상세" className="min-h-0 flex-1" bodyClassName="min-h-0 gap-2">
      {detail === undefined ? (
        <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>
          {isLoading ? "불러오는 중…" : "위 목록에서 ASN을 선택하세요."}
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className={`${w98.mono} truncate text-[15px] font-bold`} title={detail.asnNo}>
              {detail.asnNo}
            </span>
            <span className={`${w98.small} shrink-0 font-bold text-[color:var(--primary)]`}>
              {ASN_STATUS_LABEL[detail.status]}
            </span>
          </div>
          <p className={`${w98.small} truncate text-[color:var(--muted-foreground)]`}>
            {detail.sellerCode} · {detail.sellerName} · 예정일 {detail.expectedOn}
          </p>

          <div className="flex gap-1.5">
            <Btn
              disabled={!canArrive || isArriving}
              onClick={onArrive}
              className="h-7 flex-1 text-[13px] font-bold"
            >
              {isArriving ? "처리 중…" : "도착 처리"}
            </Btn>
            <Btn
              disabled={!canClose || isClosing}
              onClick={onClose}
              className="h-7 flex-1 text-[13px] font-bold"
            >
              {isClosing ? "처리 중…" : "마감"}
            </Btn>
          </div>

          <Etched />

          <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto p-1`}>
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className={`${w98.small} text-[color:var(--muted-foreground)]`}>
                  <th className="px-1 py-0.5 font-normal">품목</th>
                  <th className="px-1 py-0.5 text-right font-normal">예정</th>
                  <th className="px-1 py-0.5 text-right font-normal">수령</th>
                  <th className="px-1 py-0.5 text-right font-normal">파손</th>
                  <th className="px-1 py-0.5 text-right font-normal">미달</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.asnItemId} className="border-t border-[color:var(--surface-dim)]">
                    <td className="max-w-0 truncate px-1 py-1" title={item.productName}>
                      {item.productName}
                    </td>
                    <td className={`${w98.mono} px-1 py-1 text-right tabular-nums`}>
                      {item.expectedQty}
                    </td>
                    <td className={`${w98.mono} px-1 py-1 text-right tabular-nums`}>
                      {item.receivedQty}
                    </td>
                    <td className={`${w98.mono} px-1 py-1 text-right tabular-nums`}>
                      {item.damagedQty}
                    </td>
                    <td
                      className={`${w98.mono} px-1 py-1 text-right tabular-nums ${
                        item.shortageQty > 0 ? "font-bold text-[color:var(--status-error)]" : ""
                      }`}
                    >
                      {item.shortageQty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sunken>

          {detail.receipts.length > 0 ? (
            <Sunken className={`${w98.scroll} max-h-16 shrink-0 overflow-y-auto p-1`}>
              {detail.receipts.map((receipt) => (
                <p
                  key={receipt.receiptId}
                  className={`${w98.small} ${w98.mono} flex items-center justify-between gap-2 px-1`}
                >
                  <span className="truncate">
                    #{receipt.seqNo} · {new Date(receipt.arrivedAt).toLocaleString("ko-KR")}
                  </span>
                  <span className="shrink-0 font-bold">
                    {receipt.status === "OPEN" ? "진행 중" : "완료"}
                  </span>
                </p>
              ))}
            </Sunken>
          ) : null}

          {openReceipt !== null ? (
            <Btn
              disabled={isCompletingReceipt}
              onClick={onCompleteReceipt}
              className="h-7 shrink-0 text-[13px] font-bold"
            >
              {isCompletingReceipt ? "처리 중…" : `검수 완료 (receipt #${openReceipt.seqNo})`}
            </Btn>
          ) : null}
        </>
      )}
    </Panel>
  );
}
