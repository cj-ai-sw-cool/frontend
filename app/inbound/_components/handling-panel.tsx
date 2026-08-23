"use client";

import { Shapes, Snowflake, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Handling } from "@/lib/types";

/**
 * 취급 주의사항 — docs/02-api-spec.md §1-4 `ConfirmRequest.handling`.
 * 디자인 확정본 우측 컬럼 네 번째 패널(body.html 199~215행). 높이 188px 고정.
 *
 * 순수 표시용(presentational): API 를 부르지 않는다. 값도 변경도 전부 props 다.
 *
 * 아이콘 대응표 (확정본 Material Symbols → lucide-react)
 *   ac_unit → Snowflake · warning → TriangleAlert · category → Shapes
 *
 * 기본값은 1-3 응답의 `handlingDefaults`(= 서버의 category_attribute_map 기본값)에서 온다.
 * 작업자가 덮어쓸 수 있고, 최종값은 1-4 확정 요청에 실려 나간다.
 * 여기서 고른 값이 **1-5 입고에는 실리지 않는다** — 취급속성은 상품 마스터에 기록되는
 * 값이라 확정(1-4) 경로에만 있다. 그래서 REGISTERED 분기(확정 없이 바로 입고)에서는
 * 이 패널을 만져도 서버로 나가는 곳이 없다 — 그때는 패널 전체를 잠근다.
 *
 * ── 왜 체크박스가 아니라 큰 버튼 3개인가 ─────────────────────────────────
 *   확정본이 h-[56px] 버튼 3개다(202~213행). 장갑 낀 손을 전제한 크기라 그대로 따랐다.
 *   components/ui 에 Checkbox 가 없기도 하다.
 *
 * ── 세로 예산 (188px) ───────────────────────────────────────────────────
 *   p-panel-padding 16×2      32
 *   라벨 text-label-sm(20) + mb-3(12)   32
 *   버튼 2행: 56 + gap-3(12) + 56       124
 *   합 188 ✓
 */
export function HandlingPanel({
  value,
  onChange,
  disabled,
}: {
  value: Handling;
  onChange: (next: Handling) => void;
  /** 1-4 확정 경로가 아니어서 이 값이 어디로도 나가지 않을 때 잠근다 */
  disabled: boolean;
}) {
  const toggle = (key: keyof Handling) => () => onChange({ ...value, [key]: !value[key] });

  return (
    <section className="bg-accent p-panel-padding h-[188px] shrink-0 border-2">
      <label className="text-label-sm mb-3 block h-5">취급 주의사항 (다중선택)</label>
      <div className="grid grid-cols-2 gap-3">
        <HandlingToggle
          icon={Snowflake}
          label="냉장 필요"
          pressed={value.refrigerate}
          onToggle={toggle("refrigerate")}
          disabled={disabled}
        />
        <HandlingToggle
          icon={TriangleAlert}
          label="파손 주의"
          pressed={value.fragile}
          onToggle={toggle("fragile")}
          disabled={disabled}
        />
        <HandlingToggle
          icon={Shapes}
          label="비정형"
          pressed={value.irregular}
          onToggle={toggle("irregular")}
          disabled={disabled}
          className="col-span-2"
        />
      </div>
    </section>
  );
}

/**
 * ⚠️ shadcn Button 대신 순수 button 을 쓴다.
 *    Button 의 눌림 애니메이션(그림자만큼 오른쪽·아래로 밀림)이 확정본의 격자 안에서는
 *    칸을 어긋나게 만든다 — 확정본의 이 세 칸은 그림자 없이 테두리만 있는 판이다.
 *    "켜짐"은 그림자가 아니라 **배경색**으로 표현한다(bg-primary + 흰 글자).
 *    확정본은 :active 순간에만 secondary-container(앰버)로 반짝이게 해 뒀는데, 그건
 *    목업이라 지속 상태가 없어서다. 우리는 실제 토글이라 상태가 남아야 한다.
 */
function HandlingToggle({
  icon: Icon,
  label,
  pressed,
  onToggle,
  disabled,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  pressed: boolean;
  onToggle: () => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      className={`flex h-[56px] w-full items-center justify-center gap-2 border-2 disabled:opacity-50 ${
        pressed
          ? "bg-primary text-primary-foreground"
          : "bg-card hover:bg-muted not-disabled:cursor-pointer"
      } ${className}`}
    >
      <Icon className="size-6" aria-hidden />
      <span className="text-sub-action-md">{label}</span>
    </button>
  );
}
