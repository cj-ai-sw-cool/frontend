"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ShipmentItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * 배송 주문서 상세 — docs/01-mvp.md §3 좌측 영역, docs/02-api-spec.md §3-2 의 `items`.
 *
 * 순수 표시용(presentational): API 를 부르지 않는다. 실수량·선택 상태는 부모(page.tsx)가
 * 들고 있고 여기서는 값과 변경 콜백만 받는다.
 *
 * 컬럼 구성은 Stitch 샘플 P2(localWork/stitch-sample.html 501~506행)를 그대로 따랐다.
 *   제품 43% · 계획 수량 14% · 실수량 15% · 포장시 취급 주의 28%
 * 샘플에는 없던 "확인"(일치/불일치) 컬럼은 없앴다 — 불일치는 행 배경과 실수량 칸 밑의
 * 증감 표시, 그리고 표 위의 경고 배너로 이미 세 번 드러난다.
 *
 * 표를 `table-fixed` 로 두는 이유
 *   퍼센트 폭은 자동 레이아웃에서 "힌트"로만 취급돼, 긴 제품명이 들어오면 칸 비율이
 *   그대로 밀린다. 고정 레이아웃으로 두어야 위 비율이 실제로 지켜지고, 넘치는 제품명은
 *   샘플(513행)처럼 말줄임으로 잘린다(전체 이름은 title 툴팁으로 남긴다).
 *
 * 수량 불일치 (D-06)
 *   재피킹 백엔드는 삭제됐다. 불일치는 **프론트 화면 표시로만** 처리한다 —
 *   서버로 보내지 않고, 저장도 하지 않는다. 작업자가 실물을 재확인한 뒤 토트를 다시
 *   스캔하는 것이 정해진 흐름이다(docs/02-api-spec.md §3-6/3-7 삭제 항목).
 *   그래서 샘플에 있는 "재피킹" 버튼도 만들지 않는다.
 */

/**
 * `handling` 은 서버가 계산한 파생 속성 코드 배열이다(계약상 `string[]`).
 * 아는 코드는 한국어로 바꾸고, 모르는 코드는 코드 그대로 보여준다 —
 * 서버가 새 코드를 추가해도 화면이 비지 않도록.
 */
const HANDLING_LABEL: Record<string, string | undefined> = {
  REFRIGERATE: "냉장",
  FRAGILE: "파손주의",
  IRREGULAR: "비정형",
  LIQUID_CAUTION: "액체주의",
};

/** 눈에 띄어야 하는 취급 속성은 채운 배지로, 나머지는 외곽선 배지로 구분한다 */
const HANDLING_EMPHASIZED = new Set(["REFRIGERATE", "FRAGILE"]);

export function OrderDetailPanel({
  items,
  actualQty,
  onActualQtyChange,
  selectedProductId,
  onSelectProduct,
}: {
  items: ShipmentItem[];
  /** productId → 작업자가 센 실제 수량. 부모가 items 기준으로 초기화한다 */
  actualQty: Record<number, number>;
  onActualQtyChange: (productId: number, qty: number) => void;
  /** 지금 제품 이미지 패널에 띄워 둔 품목. null 이면 아직 고른 게 없다 */
  selectedProductId: number | null;
  /** 품목을 고르면 부모가 1-6 이미지를 조회한다 */
  onSelectProduct: (productId: number) => void;
}) {
  const mismatchCount = items.filter(
    (item) => resolveActual(actualQty, item) !== item.qty,
  ).length;

  return (
    /* 부모(Card)가 높이를 정해 준다. 경고 배너는 위에 고정하고 **표만** 스크롤한다 —
       배너까지 같이 스크롤되면 품목이 많을 때 수량 불일치 경고가 위로 밀려나 사라지고,
       놓친 불일치는 그대로 오출고가 된다. */
    <div className="flex h-full flex-col gap-3">
      {mismatchCount > 0 ? (
        <div
          role="alert"
          className="shrink-0 rounded-lg border border-status-error/40 bg-status-error/10 px-3 py-2 text-sm text-status-error"
        >
          <span className="font-medium">수량 불일치 {mismatchCount}건</span> — 실물을 다시
          확인한 뒤 토트를 재스캔하세요. 이 표시는 화면 전용이며 서버로 전송되지 않습니다.
        </div>
      ) : null}

      {/* 품목 수는 정해져 있지 않다. 고정 스테이지에서는 넘치면 잘리므로 여기서 스크롤한다 */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[43%]">제품</TableHead>
              <TableHead className="w-[14%] text-center">계획 수량</TableHead>
              <TableHead className="w-[15%] text-center">실수량</TableHead>
              <TableHead className="w-[28%] pl-3">포장시 취급 주의</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const actual = resolveActual(actualQty, item);
              const isMismatch = actual !== item.qty;
              const isSelected = item.productId === selectedProductId;

              return (
                <TableRow
                  key={item.productId}
                  // TableRow 가 이미 선택 상태 배경을 들고 있다(data-[state=selected])
                  data-state={isSelected ? "selected" : undefined}
                  className={cn(isMismatch && !isSelected && "bg-status-error/5")}
                >
                  <TableCell className="align-top">
                    {/*
                      제품 이름 자체가 "이 품목을 보겠다" 버튼이다.
                      행 전체에 onClick 을 걸면 실수량 입력칸을 누를 때도 같이 눌리고,
                      키보드로는 아예 닿지 않는다. 진짜 버튼으로 두면 둘 다 해결된다.
                      선택됐을 때 붙는 하드 섀도우는 샘플 510행의 선택 행 표현을 옮긴 것으로,
                      색은 전경색 토큰을 그대로 참조한다(components/ui/button.tsx 와 같은 방식).
                    */}
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelectProduct(item.productId)}
                      title={item.name}
                      className="flex w-full min-w-0 flex-col gap-0.5 border-2 border-transparent px-2 py-1 text-left transition-colors hover:bg-accent aria-pressed:border-border aria-pressed:bg-card aria-pressed:shadow-[4px_4px_0px_0px_var(--color-foreground)]"
                    >
                      <span className="block truncate font-medium">{item.name}</span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {item.gtin}
                      </span>
                    </button>
                  </TableCell>

                  <TableCell className="pt-3 text-center align-top text-2xl leading-none font-bold tabular-nums">
                    {item.qty}
                  </TableCell>

                  <TableCell className="align-top">
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      aria-label={`${item.name} 실수량`}
                      aria-invalid={isMismatch ? true : undefined}
                      value={actual}
                      onChange={(event) =>
                        onActualQtyChange(item.productId, toQty(event.target.value))
                      }
                      className={cn(
                        // 샘플 517행의 실수량 칸(60×48)에 맞춘 크기 — 좁은 칸에 들어가야 한다
                        "mx-auto h-12 w-[60px] px-1 text-center text-lg tabular-nums md:text-lg",
                        isMismatch && "border-status-error",
                      )}
                    />
                    {isMismatch ? (
                      <div className="mt-1 text-center text-xs font-medium text-status-error tabular-nums">
                        {formatDiff(actual - item.qty)}
                      </div>
                    ) : null}
                  </TableCell>

                  <TableCell className="pl-3 align-top whitespace-normal">
                    {item.handling.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.handling.map((code) => (
                          <Badge
                            key={code}
                            variant={HANDLING_EMPHASIZED.has(code) ? "default" : "outline"}
                          >
                            {HANDLING_LABEL[code] ?? code}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      // 샘플 547행도 빈 값 대신 "해당 없음"을 흐리게 적어 둔다
                      <span className="text-muted-foreground">해당 없음</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** 부모가 아직 초기화하지 않은 항목은 주문 수량을 기본값으로 본다 */
function resolveActual(actualQty: Record<number, number>, item: ShipmentItem): number {
  const value: number | undefined = actualQty[item.productId];
  return value === undefined ? item.qty : value;
}

/** 빈 문자열·음수·NaN 을 0 으로 정규화한다 */
function toQty(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
}

function formatDiff(diff: number): string {
  return diff > 0 ? `+${diff}` : String(diff);
}
