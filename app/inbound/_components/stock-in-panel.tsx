"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Product, StockInResponse } from "@/lib/types";

/**
 * 수량 입고 — docs/02-api-spec.md §1-5 `POST /inbound/stock-in`.
 * Stitch 샘플 P1 화면 우측 컬럼의 "수량" 패널에 대응한다
 * (측정 전 1026~1037행 / 측정 후 1409~1420행 — 두 상태가 동일하다).
 *
 * 순수 표시용(presentational): API 를 부르지 않는다. 수량 값도, 입고 실행도 전부 부모가 쥔다.
 *
 * ── 재고가 늘어나는 유일한 지점이다 (D-09) ────────────────────────────
 *   측정 확정(1-4)은 inventory_tx 를 만들지 않는다 — 치수만 확정한다.
 *   그래서 **촬영에 쓴 실물 1개도 여기 수량에 포함**해서 한 번에 넣는다.
 *   작업자가 "촬영한 건 이미 들어갔겠지" 하고 1개를 빼면 재고가 그만큼 모자라게 된다.
 *   아래 안내 문구가 그걸 막는 유일한 장치다.
 *
 * ⚠️ 응답 타입은 계약의 StockInResponse 하나뿐이다 (productId + 누적 stockQty).
 *    입고 이력·직전 재고 같은 건 응답에 없다 — 화면에서 만들어내지 않는다.
 */
export function StockInPanel({
  product,
  qty,
  onQtyChange,
  onStockIn,
  canStockIn,
  isPending,
  result,
  error,
}: {
  /** 1-1 로 잡힌 상품. 스캔 전이거나 UNKNOWN 이면 null */
  product: Product | null;
  /** 입고할 수량 — 촬영분 포함 (D-09) */
  qty: number;
  onQtyChange: (qty: number) => void;
  /** 입고 실행 — 실제 1-5 호출은 부모가 한다 */
  onStockIn: () => void;
  /**
   * 지금 입고해도 되는 시점인가.
   * 판정(1-1)과 확정(1-4) 상태를 보고 **부모가** 정한다 — 이 패널은 결과만 반영한다.
   */
  canStockIn: boolean;
  isPending: boolean;
  /** 1-5 성공 응답. 입고 후 누적 재고를 보여주는 데 쓴다 */
  result?: StockInResponse;
  error?: Error | null;
}) {
  /*
   * 여기서 막는 것은 "구조적으로 성립하지 않는 요청"뿐이다.
   * 대상 상품이 없거나(null) 수량이 1 미만이면 계약상 보낼 수 있는 요청이 아니다.
   *
   * TODO(P1): 업무 검증 규칙을 채운다. 02 에 상한/단위 규정이 없어 임의로 정하지 않았다.
   *   · 1회 입고 수량 상한 — 스캐너 오독이나 0 하나 더 누르는 실수를 어디서 끊을지.
   *   · 정수만 허용할지(현재는 소수도 그대로 통과한다). 입력칸을 비우면 0 으로 떨어지는데,
   *     "비움"과 "0" 을 갈라야 하면 문자열 상태로 바꿔야 한다
   *     (`confirm-form.tsx` 의 치수 입력이 같은 이유로 문자열을 쓴다).
   *   · 같은 세션에서 두 번 눌렀을 때의 중복 입고 방지 — 계약에 멱등 규정이 없다.
   *   · 실패 코드별 안내 분기. 02 §1-5 에 에러 목록이 없어 지금은 서버 메시지를 그대로 띄운다
   *     (코드가 정해지면 `confirm-form.tsx` 의 describeConfirmFailure 처럼 가른다).
   */
  const isSubmittable = product !== null && qty >= 1 && canStockIn && !isPending;

  return (
    <div className="space-y-4">
      {/* ── 수량 스테퍼 (샘플 1027~1036행) ─────────────────────
          샘플은 −/입력/+ 를 테두리 하나로 묶은 통짜 컨트롤이지만, 우리 버튼은 눌림 애니메이션
          (그림자만큼 밀리는 동작)이 디자인 언어라 통짜 안에 넣으면 칸이 어긋난다.
          그래서 세 조각을 떼어 놓되 크기는 샘플 그대로 뒀다(장갑 낀 손 기준). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label htmlFor="stock-in-qty" className="text-base font-medium">
          수량
        </Label>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-label="수량 1 줄이기"
            className="h-12 w-12 shrink-0 text-xl font-bold"
            disabled={product === null || isPending || qty <= 1}
            onClick={() => onQtyChange(qty - 1)}
          >
            −
          </Button>

          <Input
            id="stock-in-qty"
            type="text"
            inputMode="numeric"
            value={String(qty)}
            disabled={product === null || isPending}
            className="h-12 w-20 shrink-0 text-center text-2xl font-bold tabular-nums md:text-2xl"
            onChange={(event) => {
              const parsed = Number(event.target.value.trim());
              // 숫자가 아닌 입력은 무시한다 — 값이 튀는 것보다 안 바뀌는 편이 낫다
              if (!Number.isFinite(parsed) || parsed < 0) return;
              onQtyChange(parsed);
            }}
          />

          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-label="수량 1 늘리기"
            className="h-12 w-12 shrink-0 text-xl font-bold"
            disabled={product === null || isPending}
            onClick={() => onQtyChange(qty + 1)}
          >
            +
          </Button>
        </div>
      </div>

      {/* ★ D-09 안내 — 촬영분을 빼고 넣는 실수를 막는다. 위 파일 주석 참고 */}
      <p className="border-2 bg-muted p-3 text-sm">
        <span className="font-medium">촬영에 쓴 실물도 수량에 포함하세요.</span> 재고는 측정
        확정이 아니라 이 입고에서만 늘어납니다.
      </p>

      <Button
        type="button"
        size="lg"
        className="h-16 w-full text-lg font-semibold"
        disabled={!isSubmittable}
        onClick={onStockIn}
      >
        {isPending ? "입고 중…" : "입고"}
      </Button>

      {/* 아직 입고를 열 수 없는 이유 — 버튼만 잠그면 작업자가 원인을 모른다.
          "왜 잠겼는지"의 판단 근거는 부모가 쥐고 있으므로 여기서는 뭉뚱그려 안내만 한다. */}
      {!canStockIn && result === undefined ? (
        <p className="text-center text-sm text-muted-foreground">
          {product === null
            ? "바코드를 스캔하면 입고할 수 있습니다 (1-5)"
            : "치수가 확정되어야 입고할 수 있습니다."}
        </p>
      ) : null}

      {result !== undefined ? (
        <Alert>
          <AlertTitle>입고되었습니다</AlertTitle>
          <AlertDescription>
            <span className="tabular-nums">
              현재 재고 {result.stockQty}개 (상품 {result.productId})
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>입고에 실패했습니다</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
