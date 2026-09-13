"use client";

/**
 * "재고" 창 — 현재고 표·원장·관리자 조정을 보는 win98 창(Stage 2, 정본 §2.4·§2.6).
 *
 * `master-window.tsx` 와 같은 방식으로 **전체 화면 오버레이**로 연다 — 분석 화면의 세 칸
 * 예산에는 이미 흐름·지도·월간 패널이 꽉 차 있어서, 겹치지 않게 창으로 띄운다.
 *
 * 구성: 위 — 필터 + `GET /stock` 표. 행 클릭 → 아래 원장(`GET /stock/{id}/ledger`).
 *       맨 아래 — 관리자 조정 폼(접이식, `POST /admin/inventory/adjust`) — 화면 체크용
 *       임시 창구다(정본 §2.5 T4 이전 경로가 없는 항목을 시연에서 채우기 위함).
 *
 * ⚠️ 조정 성공 시 `useAdjustInventory` 가 재고 표·점유·존 요약을 모두 무효화한다 —
 *    3D·2D 지도가 30초 폴링을 기다리지 않고 바로 바뀐다(브리프 §3 S2.6).
 */

import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { useCenter } from "@/lib/center";
import type { StockStatus } from "@/lib/types";
import { useSellers } from "../_data/use-master";
import { useAdjustInventory, useStock, useStockLedger } from "../_data/use-inventory";
import { Btn, Etched, Field, Select, Sunken, w98 } from "./win98-ui";

const STATUS_LABEL: Record<StockStatus, string> = {
  AVAILABLE: "정상",
  HOLD: "보류",
  DAMAGED: "파손",
};

const TX_LABEL: Record<string, string> = {
  RECEIVE: "입고",
  PUTAWAY: "적치",
  PICK: "피킹",
  REBIN: "리빈",
  SHIP: "출고",
  ADJUST: "조정",
  STATUS_CHANGE: "상태변경",
};

export function InventoryWindow({ onClose }: { onClose: () => void }) {
  const center = useCenter();

  /* ── 필터 ── */
  const [sellerCode, setSellerCode] = useState("");
  const [gtin, setGtin] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [status, setStatus] = useState<StockStatus | "">("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const { data: sellers } = useSellers();
  const { data: stockPage, isLoading, error } = useStock({
    center,
    seller: sellerCode || undefined,
    gtin: gtin.trim() || undefined,
    location: locationCode.trim() || undefined,
    status: status || undefined,
    page,
    size: PAGE_SIZE,
  });

  /* 필터를 바꾸면 페이지를 처음으로 되돌린다 — 안 그러면 필터가 바뀌었는데 3페이지에
     머물러 있어 "결과가 없다"로 잘못 읽힌다 */
  const updateFilter = (fn: () => void) => {
    fn();
    setPage(0);
  };

  /* ── 선택한 행의 원장 ── */
  const [selectedStockId, setSelectedStockId] = useState<number | null>(null);
  const { data: ledgerPage, isLoading: ledgerLoading } = useStockLedger(selectedStockId);

  /* ── 관리자 조정(접이식) ── */
  const [adjustOpen, setAdjustOpen] = useState(false);

  return (
    <div className="fixed top-0 left-0 z-[210] flex h-[1004px] w-[1600px] items-center justify-center bg-[rgba(8,12,18,.72)]">
      <div className={`${w98.raised} flex h-[860px] w-[1300px] flex-col bg-[color:var(--surface)] p-[2px]`}>
        {/* 타이틀바 */}
        <div
          className={`${w98.raised} ${w98.titleText} flex shrink-0 items-center gap-2 bg-[color:var(--title-navy)] px-2 py-1 text-[color:var(--primary-foreground)]`}
        >
          <span className="flex-1">재고 — 현재고 · 원장 · 조정</span>
          <button
            type="button"
            onClick={onClose}
            title="닫기 (ESC)"
            className={`${w98.btn} ${w98.raised} flex size-5 cursor-pointer items-center justify-center`}
          >
            ✕
          </button>
        </div>

        {/* 필터 */}
        <div className={`${w98.raised} m-2 mb-0 flex shrink-0 flex-wrap items-end gap-3 bg-[color:var(--surface)] p-2`}>
          <label className="flex flex-col gap-1 text-[12px]">
            화주
            <Select
              value={sellerCode}
              onChange={(e) => updateFilter(() => setSellerCode(e.target.value))}
              className="h-7 w-[160px] text-[13px]"
            >
              <option value="">전체</option>
              {sellers?.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.code} · {s.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-[12px]">
            GTIN
            <Field
              value={gtin}
              onChange={(e) => updateFilter(() => setGtin(e.target.value))}
              placeholder="880123..."
              className="h-7 w-[160px] text-[13px]"
              mono
            />
          </label>

          <label className="flex flex-col gap-1 text-[12px]">
            로케이션
            <Field
              value={locationCode}
              onChange={(e) => updateFilter(() => setLocationCode(e.target.value))}
              placeholder="A-01-01-01"
              className="h-7 w-[140px] text-[13px]"
              mono
            />
          </label>

          <label className="flex flex-col gap-1 text-[12px]">
            상태
            <Select
              value={status}
              onChange={(e) => updateFilter(() => setStatus(e.target.value as StockStatus | ""))}
              className="h-7 w-[120px] text-[13px]"
            >
              <option value="">전체</option>
              <option value="AVAILABLE">정상</option>
              <option value="HOLD">보류</option>
              <option value="DAMAGED">파손</option>
            </Select>
          </label>

          <span className="ml-auto text-[12px] text-[color:var(--muted-foreground)]">
            {stockPage ? `총 ${stockPage.totalElements.toLocaleString()}건 · ${page + 1}/${Math.max(1, stockPage.totalPages)}페이지` : ""}
          </span>
        </div>

        {/* 표 + 원장 */}
        <div className="flex min-h-0 flex-1 gap-2 p-2">
          <div className="flex min-h-0 flex-[3] flex-col gap-2">
            <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="sticky top-0 bg-[color:var(--surface)]">
                  <tr>
                    <Th>로케이션</Th>
                    <Th>화주</Th>
                    <Th>상품</Th>
                    <Th>로트</Th>
                    <Th>상태</Th>
                    <Th>수량</Th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-3 text-[color:var(--muted-foreground)]">
                        재고를 불러오는 중…
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={6} className="p-3 text-[color:var(--status-error)]">
                        재고 목록을 불러오지 못했습니다.
                      </td>
                    </tr>
                  ) : stockPage?.content.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-3 text-[color:var(--muted-foreground)]">
                        조건에 맞는 재고가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    stockPage?.content.map((row) => (
                      <tr
                        key={row.stockId}
                        onClick={() => setSelectedStockId(row.stockId)}
                        className={`cursor-pointer border-t border-[color:var(--border)] hover:bg-[color:var(--surface-variant)] ${
                          row.stockId === selectedStockId ? "bg-[color:var(--surface-variant)] font-bold" : ""
                        }`}
                      >
                        <Td mono>{row.location.code}</Td>
                        <Td mono>{row.seller.code}</Td>
                        <Td>
                          {row.product.gtin} · {row.product.name}
                        </Td>
                        <Td mono>{row.lot.lotNo}</Td>
                        <Td>{STATUS_LABEL[row.status]}</Td>
                        <Td mono>{row.qty.toLocaleString()}</Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Sunken>

            {/* 페이지 이동 — 마스터 창에는 없던 것. 재고는 페이지네이션을 처음부터 둔다
                (브리프 §3 S2.6, 05-frontend-baseline.md "재고·주문 목록 화면은 페이지네이션·
                필터를 처음부터 둔다") */}
            <div className="flex shrink-0 items-center justify-center gap-2">
              <Btn
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-3 py-1 text-[12px]"
              >
                ◀ 이전
              </Btn>
              <Btn
                disabled={!stockPage || stockPage.last}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-[12px]"
              >
                다음 ▶
              </Btn>
            </div>
          </div>

          {/* 원장 — 선택한 행이 있을 때만 */}
          <div className="flex min-h-0 flex-[2] flex-col">
            <span className={`${w98.titleText} mb-1 shrink-0`}>
              원장{selectedStockId === null ? "" : ` — #${selectedStockId}`}
            </span>
            <Etched className="mb-2 shrink-0" />
            <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
              {selectedStockId === null ? (
                <span className="block p-3 text-[13px] text-[color:var(--muted-foreground)]">
                  왼쪽 표에서 행을 클릭하면 그 재고의 원장이 나옵니다.
                </span>
              ) : (
                <table className="w-full border-collapse text-left text-[12px]">
                  <thead className="sticky top-0 bg-[color:var(--surface)]">
                    <tr>
                      <Th>일시</Th>
                      <Th>유형</Th>
                      <Th>from → to</Th>
                      <Th>수량</Th>
                      <Th>사유</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerLoading ? (
                      <tr>
                        <td colSpan={5} className="p-3 text-[color:var(--muted-foreground)]">
                          원장을 불러오는 중…
                        </td>
                      </tr>
                    ) : ledgerPage?.content.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-3 text-[color:var(--muted-foreground)]">
                          기록이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      ledgerPage?.content.map((tx) => (
                        <tr key={tx.txId} className="border-t border-[color:var(--border)]">
                          <Td mono>{formatDateTime(tx.createdAt)}</Td>
                          <Td>{TX_LABEL[tx.txType] ?? tx.txType}</Td>
                          <Td mono>
                            {tx.fromLocation ?? "—"} → {tx.toLocation ?? "—"}
                          </Td>
                          <Td mono>{tx.qty.toLocaleString()}</Td>
                          <Td>{tx.reasonCode ?? "—"}</Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </Sunken>
          </div>
        </div>

        {/* 관리자 조정 — 접이식, 창 하단 */}
        <div className={`${w98.raised} m-2 mt-0 shrink-0 bg-[color:var(--surface)] p-2`}>
          <button
            type="button"
            onClick={() => setAdjustOpen((v) => !v)}
            className={`${w98.titleText} flex w-full items-center justify-between`}
          >
            <span>관리자 조정 (화면 체크용 임시 창구)</span>
            <span>{adjustOpen ? "▲ 접기" : "▼ 펼치기"}</span>
          </button>
          {adjustOpen && (
            <>
              <Etched className="my-1.5" />
              <AdjustForm sellers={sellers} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AdjustForm({ sellers }: { sellers: { id: number; code: string; name: string }[] | undefined }) {
  const adjust = useAdjustInventory();
  const [locationCode, setLocationCode] = useState("");
  const [sellerCode, setSellerCode] = useState("");
  const [gtin, setGtin] = useState("");
  const [lotNo, setLotNo] = useState("");
  const [status, setStatus] = useState<StockStatus>("AVAILABLE");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  const deltaNum = Number(delta);
  const canSubmit =
    locationCode.trim() !== "" &&
    sellerCode !== "" &&
    gtin.trim() !== "" &&
    lotNo.trim() !== "" &&
    reason.trim() !== "" &&
    Number.isFinite(deltaNum) &&
    deltaNum !== 0;

  const submit = () => {
    if (!canSubmit) return;
    adjust.mutate(
      {
        locationCode: locationCode.trim(),
        sellerCode,
        gtin: gtin.trim(),
        lotNo: lotNo.trim(),
        status,
        delta: deltaNum,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          setDelta("");
          setReason("");
        },
      },
    );
  };

  const failure = adjust.error ? describeAdjustFailure(adjust.error) : null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-[12px]">
        로케이션
        <Field
          value={locationCode}
          onChange={(e) => setLocationCode(e.target.value)}
          placeholder="A-01-01-01"
          className="h-7 w-[140px] text-[13px]"
          mono
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px]">
        화주
        <Select value={sellerCode} onChange={(e) => setSellerCode(e.target.value)} className="h-7 w-[140px] text-[13px]">
          <option value="">선택</option>
          {sellers?.map((s) => (
            <option key={s.id} value={s.code}>
              {s.code}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-[12px]">
        GTIN
        <Field value={gtin} onChange={(e) => setGtin(e.target.value)} className="h-7 w-[140px] text-[13px]" mono />
      </label>
      <label className="flex flex-col gap-1 text-[12px]">
        로트
        <Field value={lotNo} onChange={(e) => setLotNo(e.target.value)} className="h-7 w-[120px] text-[13px]" mono />
      </label>
      <label className="flex flex-col gap-1 text-[12px]">
        상태
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as StockStatus)}
          className="h-7 w-[100px] text-[13px]"
        >
          <option value="AVAILABLE">정상</option>
          <option value="HOLD">보류</option>
          <option value="DAMAGED">파손</option>
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-[12px]">
        증감
        <Field
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="+3 / -1"
          inputMode="numeric"
          className="h-7 w-[80px] text-right text-[13px]"
          mono
        />
      </label>
      <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[12px]">
        사유
        <Field value={reason} onChange={(e) => setReason(e.target.value)} className="h-7 text-[13px]" />
      </label>
      <Btn onClick={submit} disabled={!canSubmit || adjust.isPending} className="h-7 px-4 text-[12px] font-bold">
        {adjust.isPending ? "조정 중…" : "조정"}
      </Btn>
      {failure && (
        <span className="w-full text-[12px]" style={{ color: "var(--status-error)" }}>
          {failure}
        </span>
      )}
    </div>
  );
}

/** 409 `MIXING_VIOLATION` — 화면 체크 항목 4 (브리프 §4). 그 외는 서버 메시지 그대로 */
function describeAdjustFailure(error: Error): string {
  if (error instanceof ApiError && error.is("MIXING_VIOLATION")) {
    return "혼적 위반 — 같은 로케이션에 다른 화주, 또는 같은 상품에 다른 로트가 있습니다.";
  }
  if (error instanceof ApiError && error.is("OUT_OF_STOCK")) {
    return "조정 결과가 0 미만입니다.";
  }
  return error.message || "조정에 실패했습니다.";
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Th({ children }: { children: ReactNode }) {
  return <th className={`${w98.titleText} border-b border-[color:var(--border)] p-2`}>{children}</th>;
}

function Td({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return <td className={`p-2 ${mono ? w98.mono : ""}`}>{children}</td>;
}
