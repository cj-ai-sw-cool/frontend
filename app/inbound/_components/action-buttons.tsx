"use client";

import { Camera, Save } from "lucide-react";

/**
 * 하단 액션 — 촬영(1-3) / DB 입력(1-4 → 1-5).
 * 디자인 확정본 우측 컬럼 마지막 행(body.html 230~239행). 높이 216px 고정, 비율 1 : 2.
 *
 * 순수 표시용(presentational): API 를 부르지 않는다. 무엇을 부를지의 판단도 부모가 한다 —
 * 이 부품은 "무슨 라벨을 달고, 잠겼는지, 왜 잠겼는지"만 받는다.
 *
 * 아이콘 대응표 (확정본 Material Symbols → lucide-react)
 *   camera_alt → Camera · save → Save
 *
 * ── ★ 확정 스텝을 버튼 하나로 합쳤다 (사용자 결정) ───────────────────────
 *   이전 구현은 `승인`(1-4)과 `입고`(1-5)가 별도 버튼이었고, 확정에 성공해야 입고 버튼이
 *   열렸다. 확정본에는 그 두 단계가 없고 `DB 입력` 하나뿐이다 — 그래서 **버튼을 합친다.**
 *     REGISTERED / 이미 확정됨 → 1-5 만
 *     NEW + 촬영 완료          → 1-4 confirm(APPROVE 또는 MANUAL) → 성공 시 1-5 연쇄
 *   ⚠️ **확정을 없앤 게 아니라 버튼을 합친 것이다.** `dimStatus=NONE` 인 채로 재고만 늘리는
 *      경로는 여전히 없다 — 확정이 실패하면 연쇄가 끊겨 입고도 일어나지 않는다.
 *   이것이 이전 코드의 TODO(P1)("확정 없이 입고를 허용할지")에 대한 답이다.
 *   그 TODO 는 이 결정으로 닫혔다.
 *
 * ── ★ 게이트 미통과 / 측정 실패 — 두 갈래를 명시한다 (사용자 결정) ───────
 *   §1-3 이 정한 해제 수단은 딱 둘이다: **재촬영(1-3 재호출)** 또는 **수기 확정(1-4 MANUAL)**.
 *   확정본에는 이미 두 버튼이 다 있다 — 하단 `촬영`(=재촬영)과 우상단 `수동 입력`.
 *   그래서 새 버튼을 만들지 않고 **강조만 설계**했다:
 *     · `DB 입력` 은 잠기고, 버튼 안쪽 셋째 줄에 잠긴 이유가 그대로 뜬다.
 *     · `촬영` 버튼에 오류색 ring 이 붙어 "이쪽이 길이다"를 가리킨다.
 *     · 같은 ring 이 우상단 `수동 입력` 에도 붙는다(barcode-scan-row.tsx).
 *   두 곳에 같은 ring 이 동시에 켜지는 것이 "갈래가 둘"이라는 표현 자체다.
 *
 * ── 세로 예산 (216px) ───────────────────────────────────────────────────
 *   버튼 안쪽: 아이콘 56 + gap-3(12) + 라벨 40(text-action-lg) + 힌트 20 = 128
 *   216px 안에 여유롭게 들어간다. 힌트 줄이 두 줄이 돼도(최대 40) 넘치지 않는다.
 */
export function ActionButtons({
  captureLabel,
  canCapture,
  isCapturing,
  isCaptureUrged,
  onCapture,
  canSubmit,
  isSubmitting,
  submitBusyLabel,
  submitHint,
  onSubmit,
}: {
  /** "촬영" 또는 "재촬영" — 같은 API(1-3)라 버튼은 하나다 (§1-3) */
  captureLabel: string;
  canCapture: boolean;
  isCapturing: boolean;
  /** 게이트 미통과·측정 실패라서 재촬영이 해제 수단 중 하나인 상태인가 */
  isCaptureUrged: boolean;
  onCapture: () => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  /** 진행 중일 때 버튼이 달 라벨 — 1-3 / 1-4 / 1-5 중 어느 단계인지 부모가 정해 준다 */
  submitBusyLabel: string;
  /** 지금 누르면 무슨 API 가 나가는지, 혹은 왜 잠겼는지 — 부모가 만든 한 줄 */
  submitHint: string;
  onSubmit: () => void;
}) {
  return (
    <section className="gap-grid-gap flex h-[216px] shrink-0">
      {/* 촬영 — 확정본은 bg-secondary-container(#fcb40d 앰버) + on-secondary-container.
          ⚠️ 우리 본문 토큰에는 앰버 슬롯이 없다. 같은 값(#fcb40d)을 들고 있는 토큰은
             --sidebar-primary 뿐이라 그걸 쓴다. 하드코딩하면 팔레트를 갈아끼울 때 이
             버튼만 앰버로 남는다(debug 팔레트는 이 토큰을 연두로 바꾼다).
             본문 네임스페이스에 앰버 토큰을 새로 만드는 편이 옳지만 globals.css 를 이번
             작업에서 열 수 없었다 — PM 보고 항목이다. */}
      <ActionButton
        icon={Camera}
        label={isCapturing ? "촬영 중…" : captureLabel}
        hint={isCaptureUrged ? "재촬영으로 게이트를 다시 통과시킵니다 (1-3)" : "카메라 3대 + 저울 (1-3)"}
        disabled={!canCapture}
        urged={isCaptureUrged}
        onClick={onCapture}
        className="bg-sidebar-primary text-sidebar-primary-foreground flex-1"
      />

      {/* DB 입력 — 확정본은 bg-primary-container(#003087) + on-primary.
          우리 본문 토큰에서 그 자리에 가장 가까운 것은 --primary(#001d59)다.
          둘 다 브랜드 네이비이고 명도 차이만 있어 역할이 흐트러지지 않는다. */}
      <ActionButton
        icon={Save}
        label={isSubmitting ? submitBusyLabel : "DB 입력"}
        hint={submitHint}
        disabled={!canSubmit}
        urged={false}
        onClick={onSubmit}
        className="bg-primary text-primary-foreground flex-[2]"
      />
    </section>
  );
}

/**
 * ⚠️ shadcn Button 을 쓰지 않는다.
 *    이 두 칸은 216px 짜리 판이고, Button 의 4px 하드 섀도우 + 눌림 이동은 이 크기에서
 *    격자를 어긋나게 한다(확정본도 `active:translate-y-1` 만 쓰고 그림자는 없다).
 *    대신 확정본과 같은 눌림(아래로 4px)을 직접 붙였다.
 */
function ActionButton({
  icon: Icon,
  label,
  hint,
  disabled,
  urged,
  onClick,
  className,
}: {
  icon: typeof Camera;
  label: string;
  hint: string;
  disabled: boolean;
  urged: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      // ⚠️ 비활성에 투명도를 쓰지 않는다 — 216px 짜리 판이 반투명해지면 안쪽 라벨과
      //    잠긴 사유가 같이 흐려져서 "왜 못 누르는지"를 읽을 수 없다. 이 화면의 원래
      //    불만이 정확히 그것이었다(barcode-scan-row.tsx 의 같은 결정과 짝).
      className={`flex min-w-0 flex-col items-center justify-center gap-3 border-2 px-4 text-center active:translate-y-1 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 ${
        urged ? "ring-status-error ring-4" : ""
      } ${className}`}
    >
      <Icon className="size-14" aria-hidden />
      <span className="text-action-lg">{label}</span>
      {/* 잠긴 이유 / 다음에 나갈 API — 버튼만 잠그면 작업자가 원인을 모른다 */}
      <span className="text-label-sm line-clamp-2 opacity-80">{hint}</span>
    </button>
  );
}
