"use client";

import { Minus, Plus } from "lucide-react";

/**
 * 수량 — docs/02-api-spec.md §1-5 `POST /inbound/stock-in` 의 `qty`.
 * 디자인 확정본 우측 컬럼 다섯 번째 패널(body.html 217~228행).
 *
 * 순수 표시용(presentational): API 를 부르지 않는다. 입고 실행은 하단 `DB 입력` 버튼이 한다.
 *
 * 아이콘 대응표 (확정본 Material Symbols → lucide-react)
 *   remove → Minus · add → Plus
 *
 * ── ★ 수량 게이트가 사라졌다 (사용자 결정) ───────────────────────────────
 *   이전 구현은 `canStockIn = judgment === "REGISTERED" || isConfirmed` 로 수량 입력까지
 *   잠갔다. 그 판단은 뒤집혔다 — **상품이 잡히면 수량은 항상 활성**이다.
 *   근거: 수량은 확정(1-4)과 아무 관계가 없는 값이고, 작업자는 보통 물건을 세면서
 *   촬영을 기다린다. 확정 전에 수량을 못 넣게 막으면 두 번 일하게 된다.
 *   "확정 없이 재고만 늘어나는" 사고는 수량 칸이 아니라 **하단 DB 입력 버튼**이 막는다
 *   (action-buttons.tsx / page.tsx 의 submit plan 참고). 잠글 곳을 옮긴 것이지 없앤 게 아니다.
 *
 * ── ★ D-09 — 재고가 늘어나는 유일한 지점 ────────────────────────────────
 *   측정 확정(1-4)은 inventory_tx 를 만들지 않는다 — 치수만 확정한다.
 *   그래서 **촬영에 쓴 실물 1개도 이 수량에 포함**해서 한 번에 넣는다.
 *   작업자가 "촬영한 건 이미 들어갔겠지" 하고 1개를 빼면 재고가 그만큼 모자라게 된다.
 *   라벨 아래 한 줄이 그걸 막는 유일한 장치다 — 확정본에는 없는 줄이고, 이 한 줄 때문에
 *   패널이 확정본의 80px 이 아니라 84px 이다(세로 예산은 아래).
 *
 * ── 세로 예산 (84px) ────────────────────────────────────────────────────
 *   p-panel-padding 16×2                32
 *   라벨 text-sub-action-md(32) + 안내 text-label-sm(20)   52
 *   합 84. 우측 스테퍼는 48px 이라 세로 가운데 정렬로 들어간다.
 */
export function QuantityPanel({
  qty,
  onQtyChange,
  disabled,
}: {
  /** 입고할 수량 — 촬영분 포함 (D-09) */
  qty: number;
  onQtyChange: (qty: number) => void;
  /** 아직 상품이 안 잡혔을 때만 잠근다. 확정 여부는 보지 않는다(위 주석 참고) */
  disabled: boolean;
}) {
  /*
   * TODO(P1): 업무 검증 규칙을 채운다. 02 에 상한/단위 규정이 없어 임의로 정하지 않았다.
   *   · 1회 입고 수량 상한 — 스캐너 오독이나 0 하나 더 누르는 실수를 어디서 끊을지.
   *   · 정수만 허용할지(현재는 소수도 그대로 통과한다). 입력칸을 비우면 0 으로 떨어지는데,
   *     "비움"과 "0" 을 갈라야 하면 문자열 상태로 바꿔야 한다
   *     (수동 입력 모달의 치수 입력이 같은 이유로 문자열을 쓴다).
   *   · 같은 세션에서 두 번 눌렀을 때의 중복 입고 방지 — 계약에 멱등 규정이 없다.
   */
  return (
    <section className="bg-accent p-panel-padding flex h-[84px] shrink-0 items-center justify-between gap-4 border-2">
      <div className="flex min-w-0 flex-col">
        <label htmlFor="stock-in-qty" className="text-sub-action-md">
          수량
        </label>
        {/* ★ D-09 안내 — 촬영분을 빼고 넣는 실수를 막는다. 위 파일 주석 참고 */}
        <span className="text-label-sm text-muted-foreground truncate">
          촬영에 쓴 실물도 포함하세요 (재고는 입고에서만 늘어납니다)
        </span>
      </div>

      {/* 확정본 219~227행: −/입력/+ 를 테두리 하나로 묶은 통짜 컨트롤(150×48).
          ⚠️ 이전 구현은 셋을 떼어 놨다 — shadcn Button 의 눌림 애니메이션이 통짜 안에서
             칸을 어긋나게 만들기 때문이었다. 여기서는 판단을 뒤집어 확정본의 통짜를 따르고,
             대신 Button 을 쓰지 않고 순수 button 을 넣어 애니메이션 자체를 없앴다.
             격자가 이 화면의 정체성이라 애니메이션보다 우선한다. */}
      <div className="bg-card flex h-[48px] w-[150px] shrink-0 items-center border-2">
        <button
          type="button"
          aria-label="수량 1 줄이기"
          disabled={disabled || qty <= 1}
          onClick={() => onQtyChange(qty - 1)}
          className="hover:bg-muted flex h-full w-[40px] items-center justify-center border-r disabled:opacity-40"
        >
          <Minus className="size-6" aria-hidden />
        </button>

        <input
          id="stock-in-qty"
          type="text"
          inputMode="numeric"
          value={String(qty)}
          disabled={disabled}
          className="text-measurement-xl bg-card h-full w-[70px] min-w-0 border-0 p-0 text-center tabular-nums outline-none disabled:opacity-40"
          onChange={(event) => {
            const parsed = Number(event.target.value.trim());
            // 숫자가 아닌 입력은 무시한다 — 값이 튀는 것보다 안 바뀌는 편이 낫다
            if (!Number.isFinite(parsed) || parsed < 0) return;
            onQtyChange(parsed);
          }}
        />

        <button
          type="button"
          aria-label="수량 1 늘리기"
          disabled={disabled}
          onClick={() => onQtyChange(qty + 1)}
          className="hover:bg-muted flex h-full w-[40px] items-center justify-center border-l disabled:opacity-40"
        >
          <Plus className="size-6" aria-hidden />
        </button>
      </div>
    </section>
  );
}
