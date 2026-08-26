"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import type { Handling } from "@/lib/types";
import { Checkbox, Etched, Field, w98 } from "./win98-ui";

/**
 * 취급 주의사항 + 수량 — **떠다니는 창**이다 (사용자 결정).
 *
 * ★ 왜 창으로 뺐나: 오른쪽 열에 붙어 있을 때 이 패널이 세로를 200px 가까이 먹었고, 그만큼
 *   `Product Manifest`(제품 상세)가 눌려 있었다. 제품 정보에는 곧 사진까지 붙는다.
 *   반대로 취급 주의사항은 **한 번 정하고 마는 값**이라 늘 자리를 차지하고 있을 이유가 없다.
 *   창으로 띄우면 필요할 때 꺼내 쓰고, 방해되면 옮기거나 닫으면 된다 — 데스크톱의 방식이다.
 *
 * ★ 붙박이일 때보다 **크게** 만들었다. 자리를 다투지 않게 됐으니 좁힐 이유가 없다 —
 *   체크박스는 장갑 낀 손이 누르는 것이라 클수록 낫다.
 *
 * ⚠️ 위치 기준은 **입고 화면 본문**이다(page.tsx 가 relative 컨테이너를 만든다).
 *    창 자체가 transform 을 갖고 있어 그 안의 absolute 는 창 기준으로 잡히고, 바탕(데스크톱)
 *    경계에서 잘린다 — 스테이지 밖으로 밀려나 못 찾는 일이 없다.
 * ⚠️ 값은 여기서 들고 있지 않다. 1-4 요청의 handling 과 1-5 의 qty 는 page.tsx 의 상태이고
 *    이 창은 그리기만 한다 — 창을 닫아도 값이 사라지지 않는 이유다.
 */
export function PrecautionsWindow({
  value,
  onChange,
  disabled,
  qty,
  onQtyChange,
  qtyDisabled,
  note,
  active,
  onClose,
}: {
  value: Handling;
  onChange: (next: Handling) => void;
  disabled: boolean;
  qty: number;
  onQtyChange: (qty: number) => void;
  qtyDisabled: boolean;
  /**
   * 지금 왜 잠겨 있는지 한 줄. 잠기지 않았으면 빈 문자열이다.
   *
   * ★ 이게 없어서 "버튼이 고장 났다"로 읽혔다 (사용자 지적). 실제로는 계약상 취급속성이
   *   나갈 수 없는 상태였는데(1-4 를 부르지 않는 경로), 화면이 아무 말도 하지 않았다.
   *   잠그는 것 자체는 맞지만, **왜 잠겼는지 말하지 않는 잠금은 고장과 구별되지 않는다.**
   */
  note: string;
  /**
   * 지금 이 창을 만져야 하는 때인가 — **촬영을 마쳐 취급 주의사항을 정할 수 있는 상태**다.
   * 제목 줄 색이 이 값으로 갈린다(평소 회색 → 지금 빨강). 창은 화면 어디로든 옮길 수 있어
   * 시야 밖에 있을 수 있는데, 색이 바뀌면 옮겨 둔 창도 눈에 걸린다.
   */
  active: boolean;
  onClose: () => void;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const moveRef = useRef<{ x: number; y: number } | null>(null);

  const toggle = (key: keyof Handling) => () => onChange({ ...value, [key]: !value[key] });

  return (
    <div
      role="dialog"
      aria-label="취급 주의사항"
      /* ★ 왼쪽 아래 구석 → **화면 한가운데** (사용자 결정). 이 창은 이제 촬영 직후에만
           뜨는데, 그때 작업자의 눈은 화면 가운데(측정값·사진)에 있다. 구석에서 조용히
           열리면 못 보고 지나친다. 가운데에 뜨면 "지금 이걸 채우라"는 말이 된다.
         ⚠️ 가운데 정렬과 드래그 이동을 **한 transform 안에서** 합친다. `translate(-50%,-50%)`
            로 자기 크기의 절반을 되돌려 중앙에 세우고, 거기에 끌어 옮긴 거리를 더한다.
            둘을 나눠 쓰면(예: 정렬은 margin, 이동은 transform) 창 크기가 바뀔 때 기준이
            어긋난다. */
      className={`${w98.raised} absolute top-1/2 left-1/2 z-50 w-[380px] bg-[color:var(--surface)] p-2 shadow-[3px_3px_0_0_rgba(0,0,0,0.35)]`}
      style={{
        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
        transition: isMoving ? "none" : "transform 120ms ease-out",
      }}
    >
      {/* 타이틀바 — 여기를 잡고 끈다 */}
      <div
        onPointerDown={(event) => {
          // 닫기(×)를 눌렀을 때는 창이 끌려오면 안 된다
          if ((event.target as HTMLElement).closest("button") !== null) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          moveRef.current = { x: event.clientX, y: event.clientY };
          setIsMoving(true);
        }}
        onPointerMove={(event) => {
          const start = moveRef.current;
          if (start === null) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          moveRef.current = { x: event.clientX, y: event.clientY };
          setOffset((prev) => ({
            /* 왼쪽 아래에 붙어 있으므로 오른쪽·위로 많이, 왼쪽·아래로는 조금만 갈 수 있다.
               타이틀바가 늘 바탕 안에 남아야 다시 잡을 수 있다. */
            x: clamp(prev.x + dx, -8, 1080),
            y: clamp(prev.y + dy, -700, 8),
          }));
        }}
        onPointerUp={() => {
          moveRef.current = null;
          setIsMoving(false);
        }}
        onPointerCancel={() => {
          moveRef.current = null;
          setIsMoving(false);
        }}
        /* 두 번 누르면 처음 자리로 — 어디 두었는지 잊었을 때의 탈출구다 */
        onDoubleClick={() => setOffset({ x: 0, y: 0 })}
        title="끌어서 옮기세요 · 두 번 누르면 제자리"
        /* ★ 제목 줄 색이 **상태를 말한다** (사용자 결정).
             평소   회색 바탕 + 검은 글씨 — 옆 패널들과 같은 얼굴로 조용히 있는다
             촬영 후 빨간 바탕 + 흰 글씨 — "이제 이 창을 만질 차례"라고 스스로 알린다
           검정 + 네온 초록도 써 봤지만 평상시에 너무 튀었다. 항상 튀는 것은 아무것도
           강조하지 못한다 — 강조는 **가끔** 켜져야 강조다.
           ⚠️ 이 창은 화면 어디로든 옮길 수 있어 시야 밖에 있을 수 있다. 색이 바뀌면 옮겨 둔
              창도 눈에 걸린다 — 그게 이 색 변화의 실제 쓸모다. */
        className={`${w98.titleText} flex h-7 cursor-move items-center justify-between gap-2 px-1.5 text-[16px] font-bold tracking-[0.02em] select-none ${
          active
            ? "bg-[color:var(--status-error)] text-white"
            : "bg-[color:var(--surface)] text-[color:var(--foreground)]"
        }`}
        style={{ touchAction: "none" }}
      >
        <span>취급 주의사항 (Precautions)</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="취급 주의사항 닫기"
          title="닫기"
          className={`${w98.btn} ${w98.raised} flex size-5 items-center justify-center`}
        >
          <X className="size-3" aria-hidden />
        </button>
      </div>

      {/* 제목 아래 음각선 — 이 화면의 다른 패널(Panel)과 같은 구조다 */}
      <Etched className="mt-1 mb-2" />

      {/* ⚠️ 잠긴 이유를 **화면에 글로 띄우지는 않는다** (사용자 결정 — 설명 상자가 창을
             차지해서 답답했다). 대신 `title` 로 남긴다: 왜 안 눌리는지 궁금하면 마우스를
             올려 보면 나오고, 평소에는 아무것도 방해하지 않는다.
             ⚠️ 잠금 자체는 계약이 정한 것이다 — 취급속성은 1-4 가 나가는 경로에서만 저장된다. */}
      <div className="flex flex-col gap-3 px-1 pb-1 text-[17px]" title={note === "" ? undefined : note}>
        {/* 1-4 요청의 handling. 기본값은 1-3 응답의 handlingDefaults 에서 깔린다 (§1-3).
            확정 경로가 아니면 나갈 곳이 없어 잠근다.
            ⚠️ 목업 순서(Fragile → Cold Storage → Irregular)를 그대로 따랐다 */}
        <Checkbox
          label="Fragile · 파손 주의"
          checked={value.fragile}
          onToggle={toggle("fragile")}
          disabled={disabled}
          neon
        />
        <Checkbox
          label="Cold Storage · 냉장 필요"
          checked={value.refrigerate}
          onToggle={toggle("refrigerate")}
          disabled={disabled}
          neon
        />
        <Checkbox
          label="Irregular Size · 비정형"
          checked={value.irregular}
          onToggle={toggle("irregular")}
          disabled={disabled}
          neon
        />

        <Etched className="my-0.5" />

        {/* 1-5 의 qty — **촬영에 쓴 실물을 포함한 전체 입고 수량**이다 (D-09).
            재고는 1-5 에서만 늘어난다. 잠금 규칙이 위 체크박스와 달라서 따로 받는다. */}
        <div className="flex items-center gap-2">
          <label htmlFor="stock-in-qty" className="shrink-0 font-bold">
            수량:
          </label>
          <Field
            id="stock-in-qty"
            type="text"
            inputMode="numeric"
            mono
            value={String(qty)}
            disabled={qtyDisabled}
            onChange={(event) => {
              const parsed = Number(event.target.value.trim());
              if (!Number.isFinite(parsed) || parsed < 0) return;
              onQtyChange(parsed);
            }}
            className="h-10 w-32 text-right text-[22px] tabular-nums"
          />
          <span className={`${w98.small} truncate text-[color:var(--muted-foreground)]`}>
            촬영분 포함
          </span>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
