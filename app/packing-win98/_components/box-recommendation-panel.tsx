"use client";

import type { BoxType } from "@/lib/types";
import { Etched, Panel, Sunken, w98 } from "./win98-ui";

/**
 * 3-2 추천 박스 표시 + 3-3 오버라이드.
 *
 * 추천 박스의 재고(`recommendedBox.stockQty`)는 여기 남는다 — D-19 가 지운 것은 전체 재고
 * 목록이지, 판단에 쓰이는 이 값이 아니다.
 *
 * ★ 박스 선택을 shadcn `Select`(Radix) 대신 **네이티브 `<select>`** 로 바꿨다.
 *   ① win98 에는 둥근 팝오버가 없다. 네이티브 셀렉트는 OS 위젯이라 이 스킨과 위화감이 적다
 *   ② Radix 팝오버는 스테이지로 포탈돼서 테마를 또 따로 걸어야 한다(수동 입력 모달과 같은 문제)
 *   ③ 품절 박스를 `disabled` 로 잠그는 동작이 네이티브에도 그대로 있다
 *
 * ⚠️ 3-3 실패만 표시한다. 평소에는 아무것도 그리지 않는다. 에러 표시는 꼭 남겨야 한다 —
 *    오버라이드가 실패하면 셀렉트 값만 되돌아갈 뿐 화면에는 아무 일도 일어나지 않아서,
 *    작업자가 왜 안 바뀌는지 알 방법이 없다.
 */
export function BoxRecommendationPanel({
  recommendedBox,
  finalBox,
  fillerRecommended,
  availableBoxes,
  onOverride,
  isPending = false,
  error,
  hasShipment,
  className = "",
}: {
  recommendedBox: BoxType | null;
  finalBox: BoxType | null;
  fillerRecommended: boolean;
  availableBoxes: BoxType[];
  onOverride: (boxTypeId: number) => void;
  isPending?: boolean;
  error?: string | null;
  hasShipment: boolean;
  className?: string;
}) {
  const effectiveBox = finalBox ?? recommendedBox;
  const isOverridden =
    finalBox !== null && recommendedBox !== null && finalBox.boxTypeId !== recommendedBox.boxTypeId;

  return (
    <Panel title="Box Recommendation — 박스 추천" className={className} bodyClassName="min-h-0">
      <div className={`${w98.scroll} flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto`}>
        {!hasShipment ? (
          /* 스캔 전에도 상자 자리를 비워 두지 않는다 — 칸이 통째로 비어 있으면 이 패널에
             입체 미리보기가 있다는 걸 스캔하기 전에는 알 수 없다. 라벨은 `박스 미선택` 이라
             "이미 뭔가 골라졌다"로 읽히지도 않는다. */
          <Sunken className={`${w98.small} flex flex-1 items-center p-2 text-[color:var(--muted-foreground)]`}>
            토트를 스캔하면 추천 박스가 표시됩니다 (3-2 / 3-3)
          </Sunken>
        ) : effectiveBox === null ? (
          <Sunken className={`${w98.small} p-3 text-[color:var(--muted-foreground)]`}>
            추천 박스가 없습니다. 아래에서 직접 선택하세요.
          </Sunken>
        ) : (
          /* ⚠️ 3D 상자는 이제 이 패널에 없다 — 오른쪽 열 **위쪽**으로 올라갔다(page.tsx).
                크게 보고 싶다는 요구라 자리를 통째로 옮겼고, 여기에는 글자만 남는다. */
          <Sunken className="p-2">
            <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-baseline gap-2">
              {/* ★ 30 → **56px** (사용자 결정 — 훨씬 크게). 이 패널이 말하는 건 결국
                    "몇 호 박스를 집어라" 하나이고, 나머지 줄은 그 근거다. 근거보다 결론이
                    작으면 패널이 무슨 말을 하는지 한눈에 안 들어온다.
                  ★ **모노를 뺐다.** 이름이 `B호` 처럼 라틴+한글 섞임이라, 모노로 두면 `B` 는
                    Roboto Mono, `호` 는 맑은 고딕으로 **글리프 단위 폴백**이 일어난다.
                    30px 에서도 두 글자의 굵기·높이가 안 맞아 어긋나 보였고, 56px 에서는
                    그 차이가 그대로 커진다. 한 서체로 묶으면 `B호` 가 한 덩어리로 읽힌다.
                  ⚠️ 모노를 포기해도 잃는 게 없다 — 자릿수를 맞출 값이 아니라 이름이다.
                     정렬이 필요한 건 아래 내치수·재고이고, 거기는 모노를 그대로 둔다. */}
              <span className="text-[56px] leading-[60px] font-bold">{effectiveBox.name}</span>
              {isOverridden ? (
                <span className={`${w98.raised} ${w98.small} bg-[color:var(--surface)] px-1`}>
                  OVERRIDDEN
                </span>
              ) : null}
            </div>
            {/* ★ 13 → **17px**, 줄 간격도 함께 넓혔다 (사용자 지적 — 가독성).
                ★ 라벨(내치수·박스 재고)은 **모노를 안 쓴다.** 전부 한글이라 모노로 얻을 게
                  없고(자릿수를 맞출 값이 아니다) 맑은 고딕으로 폴백되면서 자간만 벌어진다.
                  대신 굵기를 올려 값과 짝이 보이게 했다.
                ★ 값(27.0 × 20.0 × 15.0 cm, 55개)은 **모노 + tabular-nums 를 그대로 둔다.**
                  숫자 폭이 고정이라 두 줄의 자릿수가 세로로 맞고, 박스를 바꿔 가며 비교할 때
                  숫자가 좌우로 안 흔들린다 — 이 칸에서 모노가 실제로 일하는 자리다. */}
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[17px] leading-6">
              <dt className="font-bold text-[color:var(--muted-foreground)]">내치수</dt>
              <dd className={`${w98.mono} tabular-nums`}>{formatInnerCm(effectiveBox.innerCm)}</dd>
              <dt className="font-bold text-[color:var(--muted-foreground)]">박스 재고</dt>
              <dd
                className={`${w98.mono} tabular-nums ${
                  effectiveBox.stockQty === 0 ? "font-bold text-[color:var(--status-error)]" : ""
                }`}
              >
                {effectiveBox.stockQty}개{effectiveBox.stockQty === 0 ? " (품절)" : ""}
              </dd>
              {isOverridden && recommendedBox !== null ? (
                <>
                  <dt className="font-bold text-[color:var(--muted-foreground)]">원래 추천</dt>
                  <dd className="truncate">
                    {recommendedBox.name} · {formatInnerCm(recommendedBox.innerCm)}
                  </dd>
                </>
              ) : null}
            </dl>
            </div>
          </Sunken>
        )}

        {fillerRecommended ? (
          /* ★ 두 문구의 크기를 갈랐다 (사용자 결정).
             `충전재 권장` 은 **작업자가 해야 할 일**이라 크고 굵게, 그 뒤는 **왜 그런지**라
             작게 둔다. 같은 크기로 두면 한 덩어리로 읽혀서 정작 할 일이 눈에 안 들어온다.
             ⚠️ 한 줄로 묶는다 — 설명이 접혀 두 줄이 되면 이 칸이 그만큼 커져 아래 `박스 변경`
                셀렉트를 밀어낸다. 넘치면 자르고(truncate) 전문은 title 로 남긴다. */
          <p
            className={`${w98.raised} flex items-baseline gap-2 bg-[color:var(--status-error)] px-2 py-1.5 text-white`}
            title="내용물과 박스 사이 빈 공간이 있습니다 — 완충재를 채워 주세요."
          >
            <span className="shrink-0 text-[16px] font-bold">충전재 권장</span>
            {/* ⚠️ 뒤 설명을 **`빈 공간이 있습니다` 로 줄였다** (사용자 결정 — 길어서 잘렸다).
                왜 그런지의 전문은 title 에 남는다. 350px 칸에서 한 줄에 들어가는 길이가
                그만큼이고, 잘린 문장은 안 잘린 짧은 문장보다 못하다. */}
            <span className={`${w98.small} truncate opacity-90`}>— 빈 공간이 있습니다</span>
          </p>
        ) : null}

        <Etched />

        <div className="flex items-center gap-2">
          <label htmlFor="box-override" className={`${w98.small} shrink-0`}>
            박스 변경:
          </label>
          <select
            id="box-override"
            value={effectiveBox === null ? "" : String(effectiveBox.boxTypeId)}
            disabled={isPending || availableBoxes.length === 0 || !hasShipment}
            onChange={(event) => onOverride(Number(event.target.value))}
            className={`${w98.input} ${w98.sunken} ${w98.small} h-7 min-w-0 flex-1`}
          >
            {effectiveBox === null ? <option value="">박스를 선택하세요</option> : null}
            {availableBoxes.map((box) => (
              <option key={box.boxTypeId} value={String(box.boxTypeId)} disabled={box.stockQty === 0}>
                {box.name} · {formatInnerCm(box.innerCm)} · 재고 {box.stockQty}개
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p role="alert" className={`${w98.small} text-[color:var(--status-error)]`}>
            {error}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function formatInnerCm(innerCm: BoxType["innerCm"]): string {
  return `${innerCm.map((value) => value.toFixed(1)).join(" × ")} cm`;
}
