"use client";

import { useState } from "react";
import type { OrdersImportRejected, OrdersImportResponse, Seller } from "@/lib/types";
import { Btn, Field, Panel, Select, Sunken, w98 } from "./win98-ui";

interface ItemRow {
  gtin: string;
  qty: string;
}

const EMPTY_ROW: ItemRow = { gtin: "", qty: "1" };

/**
 * 우측 열 — 테스트용 접수 폼 (브리프 §3 S5.4 "화주·수령번호·지역·품목 행(GTIN·수량)·
 * 마감시각(선택)"). 화면 체크 2·3·5(브리프 §4)가 이 폼으로 돌아간다.
 *
 * `batchId`·`orderedAt` 은 계약상 필요하지만(정본 §5.4) 브리프가 사용자 입력 항목으로
 * 두지 않았다 — 배치는 전송 봉투일 뿐이라 매 제출마다 이 화면이 타임스탬프로 만들고,
 * `orderedAt` 도 "지금 접수한다"는 뜻이라 제출 시각을 그대로 쓴다(orders-tab.tsx 참고).
 */
export function OrderImportPanel({
  sellers,
  isSubmitting,
  onSubmit,
  result,
  errorMessage,
  className = "",
}: {
  sellers?: Seller[];
  isSubmitting: boolean;
  onSubmit: (input: {
    sellerCode: string;
    receiptNo: string;
    regionCode: string;
    items: { gtin: string; qty: number }[];
    cutoffAt: string;
  }) => void;
  result: OrdersImportResponse | null;
  errorMessage: string | null;
  className?: string;
}) {
  const [sellerCode, setSellerCode] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([{ ...EMPTY_ROW }]);
  const [cutoffAt, setCutoffAt] = useState("");

  /** 접수 성공 때마다 수령번호·품목 행을 비운다 — 화주·지역은 이어서 같은 화주로 여러 건
   * 접수하는 화면 체크 흐름(브리프 §4 2·3번)이 잦아 남겨 둔다.
   *
   * 렌더 중에 상태를 조정한다(useEffect 를 안 쓴다) — `result` prop 참조가 이전 렌더와
   * 달라졌을 때만 한 번 반응해야 하는데, effect 로 하면 커밋 뒤 한 프레임 늦게 지워져 잠깐
   * 이전 값이 보인다. React 공식 권장 패턴("Adjusting state when a prop changes")대로
   * 이전 값을 상태로 기억해 두고 렌더 중 비교한다. */
  const [prevResult, setPrevResult] = useState<OrdersImportResponse | null>(null);
  if (result !== prevResult) {
    setPrevResult(result);
    if (result !== null) {
      setReceiptNo("");
      setRows([{ ...EMPTY_ROW }]);
    }
  }

  const updateRow = (index: number, patch: Partial<ItemRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const validRows = rows
    .map((row) => ({ gtin: row.gtin.trim(), qty: Number(row.qty) }))
    .filter((row) => row.gtin !== "" && Number.isFinite(row.qty) && row.qty > 0);

  const canSubmit =
    sellerCode !== "" && receiptNo.trim() !== "" && regionCode.trim() !== "" && validRows.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      sellerCode,
      receiptNo: receiptNo.trim(),
      regionCode: regionCode.trim(),
      items: validRows,
      cutoffAt,
    });
  };

  return (
    <Panel title="테스트 접수" className={`min-h-0 flex-1 ${className}`} bodyClassName="min-h-0 gap-1.5">
      <div className="flex shrink-0 flex-col gap-1.5">
        <label className={`${w98.small} flex flex-col gap-0.5`}>
          화주
          <Select value={sellerCode} onChange={(e) => setSellerCode(e.target.value)} className="h-7">
            <option value="">화주 선택</option>
            {(sellers ?? []).map((seller) => (
              <option key={seller.code} value={seller.code}>
                {seller.code} · {seller.name}
              </option>
            ))}
          </Select>
        </label>

        <div className="flex gap-1.5">
          <label className={`${w98.small} flex flex-1 flex-col gap-0.5`}>
            수령번호
            <Field
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
              placeholder="RCP-0001"
              className="h-7"
              mono
            />
          </label>
          <label className={`${w98.small} flex w-20 shrink-0 flex-col gap-0.5`}>
            지역
            <Field
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              placeholder="SEOUL"
              className="h-7"
              mono
            />
          </label>
        </div>

        <label className={`${w98.small} flex flex-col gap-0.5`}>
          마감시각 (선택)
          <Field
            type="datetime-local"
            value={cutoffAt}
            onChange={(e) => setCutoffAt(e.target.value)}
            className="h-7"
            mono
          />
        </label>
      </div>

      <span className={`${w98.small} shrink-0 font-bold`}>품목</span>
      <Sunken className={`${w98.scroll} h-28 shrink-0 overflow-y-auto p-1`}>
        <div className="flex flex-col gap-1">
          {rows.map((row, index) => (
            <div key={index} className="flex gap-1">
              <Field
                value={row.gtin}
                onChange={(e) => updateRow(index, { gtin: e.target.value })}
                placeholder="GTIN"
                className="h-6 flex-1 text-[12px]"
                mono
              />
              <Field
                type="number"
                min={1}
                value={row.qty}
                onChange={(e) => updateRow(index, { qty: e.target.value })}
                className="h-6 w-16 text-[12px]"
                mono
              />
              <Btn
                onClick={() => removeRow(index)}
                disabled={rows.length <= 1}
                className="h-6 w-6 shrink-0 text-[12px]"
                title="이 행 삭제"
              >
                ✕
              </Btn>
            </div>
          ))}
        </div>
      </Sunken>
      <Btn onClick={addRow} className="h-6 shrink-0 self-start px-2 text-[12px]">
        + 행 추가
      </Btn>

      <Btn
        onClick={submit}
        disabled={!canSubmit || isSubmitting}
        className="h-7 shrink-0 font-bold"
      >
        {isSubmitting ? "접수 중…" : "접수"}
      </Btn>

      {errorMessage !== null ? (
        <p className={`${w98.small} shrink-0 font-bold text-[color:var(--status-error)]`}>
          접수 요청 실패 — {errorMessage}
        </p>
      ) : null}

      {result !== null ? <ImportResultView result={result} /> : null}
    </Panel>
  );
}

function ImportResultView({ result }: { result: OrdersImportResponse }) {
  return (
    <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto p-1.5`}>
      <p className={`${w98.small} mb-1`}>
        접수 <b className="text-[color:var(--status-success)]">{result.orders}</b>건 · 배송단위{" "}
        <b>{result.shipments}</b>건
        {result.rejected.length > 0 ? (
          <>
            {" "}
            · 거부 <b className="text-[color:var(--status-error)]">{result.rejected.length}</b>건
          </>
        ) : null}
      </p>
      {result.rejected.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {result.rejected.map((rejected, index) => (
            <li key={index} className={`${w98.small} border-t border-[color:var(--border)] pt-1`}>
              <RejectedRow rejected={rejected} />
            </li>
          ))}
        </ul>
      ) : null}
    </Sunken>
  );
}

function RejectedRow({ rejected }: { rejected: OrdersImportRejected }) {
  const detail = rejected.detail;
  return (
    <div className="flex flex-col gap-0.5">
      <span className={w98.mono}>
        {rejected.receiptNo} · <b className="text-[color:var(--status-error)]">{rejected.reason}</b>
      </span>
      {detail !== undefined ? (
        <span className={`${w98.mono} text-[11px] text-[color:var(--muted-foreground)]`}>
          {Object.entries(detail)
            .map(([key, value]) => `${key}=${String(value)}`)
            .join(" · ")}
        </span>
      ) : null}
    </div>
  );
}
