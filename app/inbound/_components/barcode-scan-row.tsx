"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Ean13Barcode } from "./ean-13-barcode";

/**
 * 제품 바코드 행 + 수동 입력 진입 — 디자인 확정본 우측 컬럼 맨 위 96px 행
 * (body.html 148~188행). docs/02-api-spec.md §1-1 `POST /inbound/scans` 의 진입점이다.
 *
 * 순수 표시용(presentational): 여기서 API 를 부르지 않는다. 값도 결과도 전부 props 다.
 *
 * ── 96px 을 상하 2단으로 나눈다 (사용자 결정) ────────────────────────────
 *   위 44px : EAN-13 바코드 그래픽 — 아래 입력란 값을 **실제로 인코딩해서** 그린다.
 *             확정본은 고정 그림이지만 우리는 살아 있는 렌더다(ean-13-barcode.tsx 참고).
 *   중간 4px: 두 단 사이 간격
 *   아래 48px: 숫자 입력란. 스캐너가 보내는 Enter(=form submit)로 1-1 이 나간다.
 *   합 44 + 4 + 48 = 96 — 우측 컬럼 세로 예산의 첫 칸과 정확히 같다.
 *
 * ── 왜 별도 "스캔" 버튼이 없나 ───────────────────────────────────────────
 *   확정본은 이 행의 우측을 `수동 입력` 버튼이 차지한다(96px 전체 높이). 실제 바코드
 *   스캐너는 키보드로 인식돼 값을 한 번에 타이핑하고 Enter 를 보내므로, 스캔 버튼이
 *   없어도 현장 동작에는 지장이 없다. 손으로 칠 때도 Enter 로 같은 경로를 탄다.
 *
 * ── 이전 판단에서 뒤집힌 것 ──────────────────────────────────────────────
 *   이전 구현은 이 입력을 "좌우 2단 위에 걸친 전체 폭 바"로 뒀다(출고 포장 화면 규약).
 *   디자인 확정본이 오면서 바코드는 **우측 컬럼 안**으로 들어갔고, 전체 폭 바는 사라졌다.
 *   근거는 확정본 자체다 — 좌측 920px 은 측정·사진 전용이고 작업자의 입력 동선은 전부
 *   우측 488px 에 모여 있다. 출고 화면과의 자리 통일보다 확정본 준수가 우선이다.
 */
export function BarcodeScanRow({
  value,
  onChange,
  onScan,
  isPending,
  error,
  canManualInput,
  onOpenManual,
  isManualUrged,
}: {
  value: string;
  onChange: (value: string) => void;
  /** 스캔 실행 — Enter(form submit) */
  onScan: () => void;
  isPending: boolean;
  /**
   * 스캔 실패 메시지.
   * ⚠️ 1-1 은 못 찾은 바코드도 200 + UNKNOWN 으로 돌려주므로(§1-1) 이 자리는 평소 비어 있다.
   *    네트워크 오류·5xx 같은 진짜 실패만 들어온다.
   */
  error?: string | null;
  /**
   * 수동 입력을 열 수 있는가.
   * 1-4 MANUAL 은 **세션이 있어야** 성립하므로(§1-4 는 sessionId 경로 파라미터를 받는다),
   * 촬영(1-3) 전에는 치수를 받아 둬도 보낼 곳이 없다. 그래서 세션이 생긴 뒤에만 연다.
   */
  canManualInput: boolean;
  onOpenManual: () => void;
  /** 게이트 미통과·측정 실패라서 이 경로가 **해제 수단 중 하나**인 상태인가 (§1-3) */
  isManualUrged: boolean;
}) {
  const canScan = value.trim().length > 0 && !isPending;

  return (
    <div className="gap-grid-gap flex h-[96px] shrink-0 items-stretch">
      <form
        className="flex min-w-0 flex-1 flex-col gap-1"
        onSubmit={(event) => {
          // 스캐너가 보낸 Enter 로 페이지가 새로고침되지 않도록 막는다
          event.preventDefault();
          if (!canScan) return;
          onScan();
        }}
      >
        {/* 위 44px — 바코드 그래픽. 조회 중·실패일 때는 같은 자리를 상태 문구가 쓴다.
            높이가 고정이라 어떤 상태에서도 아래 입력란 위치가 흔들리지 않는다. */}
        <div className="h-[44px] shrink-0">
          {error ? (
            <p
              role="alert"
              title={error}
              className="text-label-sm text-status-error flex h-full items-center truncate font-medium"
            >
              {error}
            </p>
          ) : isPending ? (
            <p className="text-label-sm text-muted-foreground flex h-full items-center">
              바코드를 조회하는 중입니다…
            </p>
          ) : (
            <Ean13Barcode value={value} />
          )}
        </div>

        {/* 아래 48px — 숫자 입력란 */}
        <Input
          id="product-barcode"
          name="productBarcode"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="바코드 스캔 또는 입력 후 Enter"
          autoComplete="off"
          inputMode="numeric"
          // 화면에 들어오자마자 스캐너 입력을 받을 수 있게 포커스를 준다
          autoFocus
          disabled={isPending}
          aria-invalid={error ? true : undefined}
          className="text-sub-action-md h-[48px] w-full min-w-0 shrink-0 rounded-none tabular-nums md:text-2xl"
        />
      </form>

      {/* 우측 — 수동 입력. 확정본은 bg-primary(#001d59) + text-on-primary 이고,
          우리 Button 의 default variant 가 정확히 그 두 토큰(bg-primary/text-primary-foreground)이다.
          ring 강조는 게이트 미통과·측정 실패일 때만 붙는다 — 그때 이 버튼이 "두 갈래" 중
          하나이기 때문이다(다른 하나는 하단 촬영 버튼). §1-3 의 해제 수단 두 가지 그대로다. */}
      <Button
        type="button"
        disabled={!canManualInput}
        onClick={onOpenManual}
        className={`text-action-lg h-full shrink-0 rounded-none px-6 ${
          isManualUrged ? "ring-status-error ring-4" : ""
        }`}
      >
        수동 입력
      </Button>
    </div>
  );
}
