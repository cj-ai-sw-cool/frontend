"use client";

import type { Handling, Seller } from "@/lib/types";
import { Checkbox, Etched, Field, Select, w98 } from "./win98-ui";

/**
 * 취급 주의사항 + 수량 — **오른쪽 열에 붙박이로 들어가는 칸**이다 (사용자 결정).
 *
 * ★ 한때 떠다니는 창이었고, 촬영 직후에만 화면 가운데에 떴다. 두 가지가 문제였다:
 *   ① 뜨는 순간 측정값·사진을 덮었다. 그 둘을 보면서 정해야 하는 값인데 정작 그것을 가렸다.
 *   ② 창을 닫아 버리면 다시 여는 길이 제목 줄의 작은 버튼뿐이라, "어디 갔지"가 됐다.
 *   자리를 잡고 늘 보이면 둘 다 사라진다 — 세로를 내줄 여유는 마스터 이미지가 이 열을
 *   떠나면서 생겼다.
 *
 * ★ **제목 줄 색이 상태를 말한다** (창일 때부터의 규칙을 그대로 가져왔다).
 *     평소   회색 바탕 + 검은 글씨 — 옆 패널들과 같은 얼굴로 조용히 있는다
 *     촬영 후 빨간 바탕 + 흰 글씨 — "이제 여기를 만질 차례"라고 스스로 알린다
 *   붙박이가 되면서 이 색이 **더 중요해졌다.** 창은 뜨는 것만으로 시선을 끌었지만, 붙박이는
 *   늘 같은 자리에 있어서 색 말고는 "지금이다"를 말할 방법이 없다.
 *
 * ⚠️ 값은 여기서 들고 있지 않다. 1-4 요청의 handling 과 1-5 의 qty 는 page.tsx 의 상태이고
 *    이 칸은 그리기만 한다 — 창이었을 때와 같다. 계약으로 나가는 값은 바뀌지 않았다.
 */
export function PrecautionsPanel({
  value,
  onChange,
  disabled,
  qty,
  onQtyChange,
  qtyDisabled,
  sellers,
  sellersLoading,
  sellerCode,
  onSellerCodeChange,
  lotNo,
  onLotNoChange,
  expiresOn,
  onExpiresOnChange,
  note,
  active,
}: {
  value: Handling;
  onChange: (next: Handling) => void;
  disabled: boolean;
  qty: number;
  onQtyChange: (qty: number) => void;
  qtyDisabled: boolean;
  /** `GET /sellers` 목록 — select 옵션 (Stage 2 T1) */
  sellers: Seller[] | undefined;
  sellersLoading: boolean;
  /** 1-5 요청의 sellerCode — 선택 필수, 기본값 없음(정본 §2.6) */
  sellerCode: string;
  onSellerCodeChange: (code: string) => void;
  /** 1-5 요청의 lotNo — 필수 */
  lotNo: string;
  onLotNoChange: (lotNo: string) => void;
  /** 1-5 요청의 expiresOn — 선택. 빈 문자열이면 null 로 보낸다(page.tsx 가 변환) */
  expiresOn: string;
  onExpiresOnChange: (expiresOn: string) => void;
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

        <Etched className="my-0.5" />

        {/* ── 화주 · 로트 · 유통기한 (Stage 2 T1) ──────────────────────
            정본 §2.5 T1 — 1-5 요청에 화주·로트번호가 필수로 붙었다. 잠금 규칙은 수량과
            같다(qtyDisabled) — 상품을 스캔하기 전에는 무엇을 입고할지 자체가 없다.
            // Stage 2 transitional (T1): replaced in Stage 3 (ASN 검수가 대체) */}
        <div className="flex items-center gap-2">
          <label htmlFor="stock-in-seller" className="w-14 shrink-0 font-bold">
            화주:
          </label>
          <Select
            id="stock-in-seller"
            value={sellerCode}
            disabled={qtyDisabled || sellersLoading}
            onChange={(event) => onSellerCodeChange(event.target.value)}
            className="h-8 flex-1 text-[15px]"
          >
            <option value="">{sellersLoading ? "불러오는 중…" : "선택하세요"}</option>
            {sellers?.map((seller) => (
              <option key={seller.id} value={seller.code}>
                {seller.code} · {seller.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="stock-in-lot" className="w-14 shrink-0 font-bold">
            로트:
          </label>
          <Field
            id="stock-in-lot"
            type="text"
            mono
            value={lotNo}
            disabled={qtyDisabled}
            onChange={(event) => onLotNoChange(event.target.value)}
            placeholder="L-2026-09"
            maxLength={40}
            className="h-8 flex-1 text-[15px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="stock-in-expires" className="w-14 shrink-0 font-bold">
            유통기한:
          </label>
          <Field
            id="stock-in-expires"
            type="date"
            mono
            value={expiresOn}
            disabled={qtyDisabled}
            onChange={(event) => onExpiresOnChange(event.target.value)}
            className="h-8 flex-1 text-[14px]"
          />
          <span className={`${w98.small} shrink-0 text-[color:var(--muted-foreground)]`}>선택</span>
        </div>

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
            className="h-8 w-24 text-right text-[18px] tabular-nums"
          />
          <span className={`${w98.small} truncate text-[color:var(--muted-foreground)]`}>
            촬영분 포함
          </span>
        </div>
      </div>
    </div>
  );
}
