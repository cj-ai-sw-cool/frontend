"use client";

import { TriangleAlert } from "lucide-react";
import type { ShipmentItem } from "@/lib/types";
import { Field, Panel, Sunken, w98 } from "./win98-ui";

/**
 * 3-2 품목 표 — win98 의 리스트 뷰 모양(파인 상자 + 회색 머리행 + 눌린 선택 행).
 *
 * 실수량 입력·불일치 표시는 **프론트 상태로만** 존재한다 (D-06). 서버로 나가지 않는다.
 *
 * ⚠️ 불일치 경고는 표 **바깥**에 고정한다. 배너까지 같이 스크롤되면 품목이 많을 때 경고가
 *    위로 밀려나 사라지고, 놓친 불일치는 그대로 오출고가 된다.
 * ⚠️ 품목 수는 정해져 있지 않다. 고정 스테이지에서는 넘치면 잘리므로 표만 안에서 스크롤한다.
 */
export function ShipmentItemsPanel({
  items,
  actualQty,
  onActualQtyChange,
  selectedProductId,
  onSelectProduct,
  isLoading,
  hasShipment,
}: {
  items: ShipmentItem[];
  actualQty: Record<number, number>;
  onActualQtyChange: (productId: number, qty: number) => void;
  selectedProductId: number | null;
  onSelectProduct: (productId: number) => void;
  isLoading: boolean;
  hasShipment: boolean;
}) {
  const mismatchCount = items.filter((item) => resolveActual(actualQty, item) !== item.qty).length;

  return (
    <Panel
      title="품목"
      right={
        mismatchCount > 0 ? (
          <span
            role="alert"
            className={`${w98.small} flex shrink-0 items-center gap-1 font-bold text-[color:var(--status-error)]`}
          >
            <TriangleAlert className="size-3.5" aria-hidden />
            수량 불일치 {mismatchCount}건 — 실물 확인 후 재스캔
          </span>
        ) : undefined
      }
      className="min-h-0 flex-1"
    >
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        {isLoading ? (
          <Placeholder>조회 중…</Placeholder>
        ) : !hasShipment ? (
          <Placeholder>토트를 스캔하면 품목이 표시됩니다 (3-2)</Placeholder>
        ) : items.length === 0 ? (
          <Placeholder>이 배송단위에 품목이 없습니다</Placeholder>
        ) : (
          <table className="w-full table-fixed border-collapse">
            {/* win98 리스트 뷰의 머리행 — 튀어나온 회색 버튼처럼 생겼다 */}
            <thead className="sticky top-0 z-10">
              <tr className="bg-[color:var(--surface)]">
                <Th className="w-[46%]">제품</Th>
                {/* ⚠️ `계획` 이 아니라 **주문** 이다 (사용자 결정). 이 값은 3-2 응답의
                    `items[].qty` — 주문서에 적힌 수량이지 우리가 세운 계획이 아니다.
                    옆 칸(실수량)과 짝을 이루는 말이기도 하다: 주문 ↔ 실물. */}
                <Th className="w-[12%] text-center">주문</Th>
                <Th className="w-[16%] text-center">실수량</Th>
                <Th className="w-[26%]">포장시 취급 주의</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const actual = resolveActual(actualQty, item);
                const isMismatch = actual !== item.qty;
                const isSelected = item.productId === selectedProductId;

                return (
                  /* ★ 선택 강조를 **제품명 칸으로만** 좁혔다 (사용자 결정).
                     예전에는 행 전체가 네이비로 칠해지면서 글자가 흰색으로 뒤집혔는데,
                     그러면 GTIN·수량 같은 작은 글자가 오히려 안 읽혔고 그 행만 화면에서 튀었다.
                     이제 행은 조용하고, 강조는 실제로 고른 것(제품)에만 붙는다.
                     ⚠️ 분홍(수량 불일치)은 행 전체에 그대로 둔다 — 그건 "이 행에 문제가 있다"는
                        뜻이라 칸 하나가 아니라 행의 성질이다.
                     ★ 그래서 **둘이 더 이상 다투지 않는다** (사용자 지적: 예전엔 선택이 이겨서
                       불일치 분홍이 가려졌다). 지금은 자리가 다르다 — 문제는 행 바탕이,
                       선택은 제품명 칸이 맡는다. 한 행이 동시에 둘 다일 때 둘 다 보인다. */
                  <tr key={item.productId} className={isMismatch ? "bg-[#ffdad6]" : ""}>
                    <td className="border-b border-[color:var(--surface-variant)] px-1 py-2 align-middle">
                      {/* 제품 이름 자체가 "이 품목을 보겠다" 버튼이다.
                          행 전체에 onClick 을 걸면 실수량 입력칸을 누를 때도 같이 눌리고,
                          키보드로는 아예 닿지 않는다. 진짜 버튼으로 두면 둘 다 해결된다. */}
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onSelectProduct(item.productId)}
                        title={item.name}
                        /* 고른 칸만 네이비로 채우고 왼쪽에 두꺼운 띠를 둔다.
                           띠가 있으면 표를 세로로 훑을 때 어느 줄을 보고 있었는지 바로 찾는다 */
                        className={`flex w-full min-w-0 flex-col gap-0.5 border-l-4 px-2 py-1 text-left ${
                          isSelected
                            ? "border-[#000040] bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                            : "border-transparent"
                        }`}
                      >
                        <span className="block truncate text-[17px] leading-6 font-bold">{item.name}</span>
                        <span
                          className={`${w98.mono} block truncate text-[13px] leading-5 ${
                            isSelected ? "opacity-80" : ""
                          }`}
                        >
                          {item.gtin}
                        </span>
                      </button>
                    </td>
                    <td
                      className={`${w98.mono} border-b border-[color:var(--surface-variant)] px-1 py-2 text-center align-middle text-[22px] font-bold tabular-nums`}
                    >
                      {item.qty}
                    </td>
                    <td className="border-b border-[color:var(--surface-variant)] px-1 py-2 align-middle">
                      <Field
                        type="text"
                        inputMode="numeric"
                        mono
                        aria-label={`${item.name} 실수량`}
                        aria-invalid={isMismatch ? true : undefined}
                        value={String(actual)}
                        onChange={(event) =>
                          onActualQtyChange(item.productId, toQty(event.target.value))
                        }
                        className="mx-auto block h-8 w-20 text-center text-[18px] tabular-nums"
                      />
                      {isMismatch ? (
                        <div
                          className={`${w98.small} ${w98.mono} mt-0.5 text-center font-bold text-[color:var(--status-error)]`}
                        >
                          {formatDiff(actual - item.qty)}
                        </div>
                      ) : null}
                    </td>
                    <td
                      className="border-b border-[color:var(--surface-variant)] px-1 py-2 align-middle text-[13px]"
                    >
                      {item.handling.length > 0 ? (
                        /* ★ **버튼 모양(베벨) + 글자색**을 같이 쓴다 (사용자 결정).
                           한때 글자만 남겨 봤는데, 이 화면에서는 버튼처럼 튀어나온 쪽이 훨씬
                           보기 좋다는 판단이었다 — win98 화면에서 네모난 조각은 그 자체로
                           "항목 하나"로 읽힌다.
                           색은 그대로 살린다: 냉장 = 파랑 · 파손주의 = 빨강 · 그 외 = 본문색.
                           ⚠️ 색만으로 뜻을 전하지는 않는다 — 글자가 그대로 있으므로 색을 못 보는
                              사람도 `냉장`/`파손주의` 를 읽을 수 있다. */
                        <div className="flex flex-wrap gap-1">
                          {item.handling.map((code) => (
                            <span
                              key={code}
                              className={`${w98.raised} bg-[color:var(--surface)] px-1.5 py-0.5 font-bold ${
                                HANDLING_COLOR[code] ?? "text-[color:var(--foreground)]"
                              }`}
                            >
                              {HANDLING_LABEL[code] ?? code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[color:var(--muted-foreground)]">해당 없음</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Sunken>
    </Panel>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`${w98.raised} bg-[color:var(--surface)] px-1 py-1 text-left font-normal ${className}`}
    >
      {children}
    </th>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-full items-center justify-center p-4 text-center text-[13px] text-[color:var(--muted-foreground)]"
    >
      {children}
    </div>
  );
}

const HANDLING_LABEL: Record<string, string | undefined> = {
  REFRIGERATE: "냉장",
  FRAGILE: "파손주의",
  IRREGULAR: "비정형",
  LIQUID_CAUTION: "액체주의",
};

/**
 * 취급 속성별 글자색.
 * 놓치면 상품이 상하거나 깨지는 둘에만 색을 준다 — 전부 색칠하면 아무것도 강조되지 않는다.
 */
const HANDLING_COLOR: Record<string, string | undefined> = {
  REFRIGERATE: "text-[#0b3ea8]", // 냉장 — 차가운 쪽
  FRAGILE: "text-[color:var(--status-error)]", // 파손 주의 — 경고
};

function resolveActual(actualQty: Record<number, number>, item: ShipmentItem): number {
  const value: number | undefined = actualQty[item.productId];
  return value === undefined ? item.qty : value;
}

function toQty(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
}

function formatDiff(diff: number): string {
  return diff > 0 ? `+${diff}` : String(diff);
}
