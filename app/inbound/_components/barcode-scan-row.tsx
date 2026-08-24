"use client";

import { CornerDownLeft } from "lucide-react";
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
 *   위 44px : EAN-13 바코드 그래픽 — **조회를 실행한 값**을 실제로 인코딩해서 그린다.
 *             확정본은 고정 그림이지만 우리는 진짜 인코딩이다(ean-13-barcode.tsx 참고).
 *   중간 4px: 두 단 사이 간격
 *   아래 48px: 숫자 입력란 + 안쪽 우측 조회 버튼. Enter(=form submit)로 1-1 이 나간다.
 *   합 44 + 4 + 48 = 96 — 우측 컬럼 세로 예산의 첫 칸과 정확히 같다.
 *
 * ── ★ 그래픽은 타이핑을 따라가지 않는다 (사용자 결정) ────────────────────
 *   이전 개정은 입력란 값을 그대로 그렸다 — 치는 대로 막대가 바뀌는 "살아 있는 렌더"였다.
 *   **뒤집혔다.** 한 자리 칠 때마다 95개 모듈이 통째로 재배열되면 막대가 요동치고,
 *   그 중간 값들은 어차피 아무 상품도 가리키지 않는다. 바코드는 "지금 화면이 들고 있는
 *   상품"을 눈으로 대조하는 그림이므로 **확정된 값만** 그려야 대조가 성립한다.
 *   그래서 `value`(작업 중)와 `scannedValue`(확정됨)를 **서로 다른 상태로 분리**했다.
 *
 * ── ★ 조회 버튼은 입력란 안쪽에 있다 (사용자 결정) ───────────────────────
 *   확정본은 이 행의 우측을 `수동 입력` 이 통째로 차지해서(96px) 별도 스캔 버튼 자리가
 *   없다. 스캐너는 값을 한 번에 타이핑하고 Enter 를 자동으로 보내므로 원래 버튼이 필요
 *   없지만, **손으로 칠 때는** "다 쳤는데 이제 뭘 누르지"가 생긴다.
 *   그래서 13자리가 차고 아직 조회하지 않았을 때만 입력란 **안쪽 우측**에 40px 버튼이
 *   나타난다. 행의 96px 예산을 한 픽셀도 쓰지 않으면서 다음 행동을 가리키는 자리다.
 *   버튼 클릭과 Enter 키는 같은 동작이다(둘 다 form submit).
 *
 * ── 이전 판단에서 뒤집힌 것 ──────────────────────────────────────────────
 *   이전 구현은 이 입력을 "좌우 2단 위에 걸친 전체 폭 바"로 뒀다(출고 포장 화면 규약).
 *   디자인 확정본이 오면서 바코드는 **우측 컬럼 안**으로 들어갔고, 전체 폭 바는 사라졌다.
 *   근거는 확정본 자체다 — 좌측 920px 은 측정·사진 전용이고 작업자의 입력 동선은 전부
 *   우측 488px 에 모여 있다. 출고 화면과의 자리 통일보다 확정본 준수가 우선이다.
 */
export function BarcodeScanRow({
  value,
  scannedValue,
  onChange,
  onScan,
  isPending,
  error,
  canManualInput,
  onOpenManual,
  isManualUrged,
}: {
  /** 입력란에 지금 찍혀 있는 값. 작업 중이라 계속 바뀐다 */
  value: string;
  /**
   * **조회를 실행한** 값. 바코드 그래픽은 이 값만 그린다.
   *
   * ⚠️ 입력란 값과 일부러 분리한 상태다 (사용자 결정).
   *    한 자리 칠 때마다 다시 인코딩하면 막대가 요동쳐서 눈이 그걸 좇게 되는데,
   *    그 사이 값들은 어차피 의미 없는 중간 상태다. 바코드는 "지금 화면이 들고 있는
   *    상품"을 대조하는 그림이라 **확정된 값만** 그려야 대조가 성립한다.
   */
  scannedValue: string;
  onChange: (value: string) => void;
  /** 스캔 실행 — Enter 키 또는 입력란 안쪽 조회 버튼 (둘은 같은 동작이다) */
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
   *
   * ⚠️ **판단이 뒤집혔다** (사용자 결정). 이전 개정은 "1-4 MANUAL 은 세션이 있어야 성립하므로
   *    (§1-4 는 sessionId 를 경로 파라미터로 받는다) 촬영(1-3) 전에는 치수를 받아 둬도 보낼
   *    곳이 없다"는 이유로 **촬영 뒤에만** 열었다. 계약 서술은 지금도 맞다 — 틀린 건
   *    "그러니 버튼을 잠근다"는 결론이었다.
   *    · 실제 증상: 이 버튼은 화면에서 제일 큰 글씨(32px)인데도 **평소에 흐리게** 보였다.
   *      원인은 색·크기가 아니라 `disabled:opacity-50` 이었다 — 촬영 전이 기본 상태라
   *      작업자가 이 버튼을 보는 시간의 대부분이 비활성이었다.
   *    · 업무 근거가 더 크다: **촬영이 물리적으로 불가한 경우가 있다.** 촬영이 메인 기능이고
   *      화면도 그쪽을 유도하지만, 불가할 때 입고 자체가 막히면 안 된다.
   *    · 그래서 조건은 이제 `product !== null` **하나뿐**이다. 촬영 여부도, 확정 여부도 보지
   *      않는다 — 이미 확정된 상품(REGISTERED 포함)도 수기로 고쳐 다시 저장할 수 있어야
   *      한다는 것이 사용자 요구다.
   *    · 세션은 `적용` 이 아니라 **`DB 입력` 시점**에 확보한다(없으면 1-3 을 먼저 부른다 —
   *      page.tsx 의 handleDbSubmit 참고). `적용` 에서 부르면 촬영이 불가한 상황에서
   *      모달이 그대로 멈춘다.
   */
  canManualInput: boolean;
  onOpenManual: () => void;
  /** 게이트 미통과·측정 실패라서 이 경로가 **해제 수단 중 하나**인 상태인가 (§1-3) */
  isManualUrged: boolean;
}) {
  const trimmed = value.trim();
  const canScan = trimmed.length > 0 && !isPending;

  /**
   * 입력란 안쪽 조회 버튼의 노출 규칙 (사용자 결정).
   *   13자리가 찼는데 아직 그 값으로 조회하지 않았다 → 보인다
   *   조회한 값과 입력란 값이 같아졌다               → 사라진다
   *   13자리 미만                                    → 안 보인다
   * 뜻은 하나다: **"지금 이 값은 아직 조회 안 된 새 값이다."**
   * 스캐너는 엔터를 자동으로 보내므로 이 버튼을 볼 일이 없다 — 손으로 칠 때만 보인다.
   */
  const showScanButton = trimmed.length === 13 && trimmed !== scannedValue && !isPending;

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
            <Ean13Barcode value={scannedValue} />
          )}
        </div>

        {/* 아래 48px — 숫자 입력란 + 안쪽 우측 조회 버튼 */}
        <div className="relative h-[48px] shrink-0">
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
            // pr 은 버튼이 없을 때도 늘 비워 둔다 — 버튼이 나타날 때 숫자가 밀리면
            // 13자리를 세고 있던 눈이 흔들린다. 자리를 미리 잡아 두는 편이 낫다.
            className="text-sub-action-md h-full w-full min-w-0 rounded-none pr-12 tabular-nums md:text-2xl"
          />

          {showScanButton ? (
            <button
              type="submit"
              aria-label="바코드 조회 (Enter)"
              title="바코드 조회 (Enter)"
              className="bg-primary text-primary-foreground absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center border-2"
            >
              <CornerDownLeft className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>
      </form>

      {/* 우측 — 수동 입력. 확정본은 bg-primary(#001d59) + text-on-primary 이고,
          우리 Button 의 default variant 가 정확히 그 두 토큰(bg-primary/text-primary-foreground)이다.
          ring 강조는 게이트 미통과·측정 실패일 때만 붙는다 — 그때 이 버튼이 "두 갈래" 중
          하나이기 때문이다(다른 하나는 하단 촬영 버튼). §1-3 의 해제 수단 두 가지 그대로다. */}
      <Button
        type="button"
        disabled={!canManualInput}
        onClick={onOpenManual}
        // ⚠️ `disabled:opacity-50`(components/ui/button.tsx, 팀 공유라 못 고침)을 이 버튼에서만
        //    덮는다. 반투명은 "지금 못 쓴다"를 알리는 대신 **글씨를 못 읽게** 만든다 —
        //    32px 흰 글자 / 네이비 배경(대비 15.7:1)이 회색 얼룩이 됐던 자리다.
        //    비활성일 때는 투명도 대신 **연한 배경 + 읽히는 글자색**으로 간다.
        className={`text-action-lg h-full shrink-0 rounded-none px-6 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 ${
          isManualUrged ? "ring-status-error ring-4" : ""
        }`}
      >
        수동 입력
      </Button>
    </div>
  );
}
