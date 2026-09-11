"use client";

import type { Handling } from "@/lib/types";
import { Checkbox, Etched, w98 } from "./win98-ui";

/**
 * 취급 주의사항 — **오른쪽 열에 붙박이로 들어가는 칸**이다 (사용자 결정).
 *
 * ★ 한때 떠다니는 창이었고, 촬영 직후에만 화면 가운데에 떴다. 두 가지가 문제였다:
 *   ① 뜨는 순간 측정값·사진을 덮었다. 그 둘을 보면서 정해야 하는 값인데 정작 그것을 가렸다.
 *   ② 창을 닫아 버리면 다시 여는 길이 제목 줄의 작은 버튼뿐이라, "어디 갔지"가 됐다.
 *   자리를 잡고 늘 보이면 둘 다 사라진다.
 *
 * ★ **제목 줄 색이 상태를 말한다** (창일 때부터의 규칙을 그대로 가져왔다).
 *     평소   회색 바탕 + 검은 글씨 — 옆 패널들과 같은 얼굴로 조용히 있는다
 *     촬영 후 빨간 바탕 + 흰 글씨 — "이제 여기를 만질 차례"라고 스스로 알린다
 *
 * ⚠️ 값은 여기서 들고 있지 않다. 1-4 요청의 handling 은 page.tsx 의 상태이고
 *    이 칸은 그리기만 한다 — 창이었을 때와 같다.
 *
 * ⚠️ **Stage 2 전환기(T1)의 화주·로트·유통기한·수량 칸을 여기서 뺐다** — 로트는 ASN 품목이
 *    갖고 오고 화주는 선택한 ASN이 정하므로, 이 화면에서 다시 물을 이유가 없다(정본 §3.1·§3.5).
 *    그 네 칸은 `receipt-input-panel.tsx`(검수 입력 패널)로 갔다 — 예정 수량 표시, 수령·파손
 *    수량, 로트·유통기한 정정(기본값 = ASN 값)이 그 칸의 역할이다.
 *    // Stage 2 transitional (T1) ended — replaced by ASN 검수 (Stage 3)
 */
export function PrecautionsPanel({
  value,
  onChange,
  disabled,
  note,
  active,
}: {
  value: Handling;
  onChange: (next: Handling) => void;
  disabled: boolean;
  /**
   * 지금 왜 잠겨 있는지 한 줄. 잠기지 않았으면 빈 문자열이다.
   *
   * ★ 이게 없어서 "버튼이 고장 났다"로 읽혔다 (사용자 지적). 실제로는 계약상 취급속성이
   *   나갈 수 없는 상태였는데(1-4 를 부르지 않는 경로), 화면이 아무 말도 하지 않았다.
   *   잠그는 것 자체는 맞지만, **왜 잠겼는지 말하지 않는 잠금은 고장과 구별되지 않는다.**
   */
  note: string;
  /** 지금 이 칸을 만져야 하는 때인가 — 촬영을 마쳐 취급 주의사항을 정할 수 있는 상태다 */
  active: boolean;
}) {
  const toggle = (key: keyof Handling) => () => onChange({ ...value, [key]: !value[key] });

  return (
    <div className={`${w98.raised} shrink-0 bg-[color:var(--surface)] p-2`}>
      <div
        className={`${w98.titleText} flex h-6 items-center px-1.5 text-[14px] font-bold tracking-[0.02em] select-none ${
          active
            ? "bg-[color:var(--status-error)] text-white"
            : "bg-[color:var(--surface)] text-[color:var(--foreground)]"
        }`}
      >
        취급 주의사항
      </div>

      {/* 제목 아래 음각선 — 이 화면의 다른 패널(Panel)과 같은 구조다 */}
      <Etched className="mt-1 mb-1.5" />

      {/* ⚠️ 잠긴 이유를 **화면에 글로 띄우지는 않는다** (사용자 결정 — 설명 상자가 자리를
             차지해서 답답했다). 대신 `title` 로 남긴다: 왜 안 눌리는지 궁금하면 마우스를
             올려 보면 나오고, 평소에는 아무것도 방해하지 않는다.
             ⚠️ 잠금 자체는 계약이 정한 것이다 — 취급속성은 1-4 가 나가는 경로에서만 저장된다. */}
      <div
        className="flex flex-col gap-2 px-1 pb-0.5 text-[15px]"
        title={note === "" ? undefined : note}
      >
        {/* 1-4 요청의 handling. 기본값은 1-3 응답의 handlingDefaults 에서 깔린다 (§1-3).
            확정 경로가 아니면 나갈 곳이 없어 잠근다.
            ⚠️ 목업 순서(Fragile → Cold Storage → Irregular)를 그대로 따랐다 */}
        <Checkbox
          label="파손 주의"
          checked={value.fragile}
          onToggle={toggle("fragile")}
          disabled={disabled}
          neon
        />
        <Checkbox
          label="냉장 필요"
          checked={value.refrigerate}
          onToggle={toggle("refrigerate")}
          disabled={disabled}
          neon
        />
        <Checkbox
          label="비정형"
          checked={value.irregular}
          onToggle={toggle("irregular")}
          disabled={disabled}
          neon
        />
      </div>
    </div>
  );
}
