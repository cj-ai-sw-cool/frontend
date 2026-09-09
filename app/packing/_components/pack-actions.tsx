"use client";

import { Undo2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Btn, Sunken, w98 } from "./win98-ui";

/**
 * 3-8 포장 완료 + 재피킹 — 목업 우측 하단 버튼 행과 같은 자리다.
 *
 * ★ `재피킹` 은 **동작이 없다** (D-20 으로 화면에 두기로 확정, 호출할 API 는 D-06 으로 없음).
 *   실물 토트를 출고 라인으로 되돌리는 운영 절차라 시스템 상태 전이가 없다.
 *   그래서 핸들러를 아예 붙이지 않는다 — 눌러도 아무 일도 일어나지 않는 것이 현재 정상이다.
 *   죽은 버튼처럼 보이지 않게 비활성으로 두지는 않는다. 잠기는 조건은 배송단위가 없을 때
 *   하나뿐이고, 이건 포장 완료와 같은 규칙이다(배송단위가 없으면 되돌릴 토트도 없다).
 *
 * ⚠️ 실패 안내는 계약이 정한 409 두 가지다(§3-8). 평소에는 자리를 차지하지 않지만,
 *    서버 message 를 그대로 쓰는 갈래가 있어 길이가 예측되지 않는다. 여기가 무한정 자라면
 *    위 제품 이미지 패널을 0 까지 밀어내므로 높이를 묶고 안에서 스크롤시킨다 —
 *    잘라 없애는 게 아니라서 전문은 그대로 읽힌다.
 */
export function PackActions({
  onComplete,
  disabled = false,
  isPending,
  error,
}: {
  onComplete: () => void;
  disabled?: boolean;
  isPending: boolean;
  error?: Error | null;
}) {
  const failure = error ? describeFailure(error) : null;

  return (
    <div className="flex shrink-0 flex-col gap-2">
      {failure ? (
        <Sunken
          className={`${w98.scroll} ${w98.small} max-h-[84px] overflow-y-auto p-2 text-[color:var(--status-error)]`}
        >
          <span className="block font-bold">{failure.title}</span>
          <span className="block">{failure.detail}</span>
        </Sunken>
      ) : null}

      {/* ★ 두 버튼의 경계를 **바로 위 칸의 세로선과 맞춘다** (사용자 결정).
          위 줄이 `제품 이미지(222) | gap 8 | 박스 추천(470)` 이라, 아래도 같은 자리에서
          갈라야 오른쪽 열 전체가 한 줄로 정렬돼 보인다. 비율로 두면 엉뚱한 자리에서 갈려
          위 세로선과 어긋나고, 그 어긋남이 눈에 걸린다.
          ⚠️ 222 는 page.tsx 의 열 폭(700)에서 박스 추천(470)과 gap(8)을 뺀 값이다.
             셋 중 하나가 바뀌면 여기도 같이 바뀌어야 한다. */}
      <div className="flex h-16 gap-2">
        <Btn
          disabled={disabled}
          className="flex w-[222px] shrink-0 flex-col items-center justify-center gap-1"
          title="실물 토트를 출고 라인으로 되돌립니다 (운영 절차 · 시스템 전이 없음)"
        >
          <Undo2 className="size-5" aria-hidden />
          재피킹
        </Btn>
        {/* ★ **아이콘 없이 글자만** 둔다 (사용자 결정). 이 화면에서 마지막으로 누르는
            버튼이고 옆의 `재피킹` 과 헷갈리면 안 되는데, 아이콘이 붙으면 두 버튼이
            "아이콘+글자"라는 같은 모양이 되어 형태로는 구분되지 않는다. 글자만 크게 두면
            생김새부터 다르다.
            ⚠️ 진행 중 스피너도 뺐다 — 아이콘을 없애기로 한 자리에 스피너만 남으면 결국
               아이콘이 있는 셈이다. 대신 글자가 `처리 중…` 으로 바뀌고 버튼이 잠긴다.
               상태는 여전히 보이고, 모양은 변하지 않는다. */}
        <Btn
          disabled={disabled || isPending}
          onClick={onComplete}
          /* ⚠️ 줄 높이를 같이 올린다 — `.theme` 의 전역 16px 로는 20px 한글 윗부분이 잘린다 */
          className="flex min-w-0 flex-1 items-center justify-center text-[20px] leading-[30px] font-bold"
          title="포장을 완료하고 재고를 차감합니다 (3-8)"
        >
          {isPending ? "처리 중…" : "포장 완료"}
        </Btn>
      </div>
    </div>
  );
}

/**
 * 3-8 실패 안내 — 코드별로 작업자가 할 행동이 다르므로 메시지를 가른다.
 * 판별은 `lib/api.ts` 의 `ApiError.is()` 를 쓴다(문자열 비교를 흩뿌리지 않기 위해).
 */
function describeFailure(error: Error): { title: string; detail: string } {
  if (error instanceof ApiError) {
    if (error.is("OUT_OF_STOCK")) {
      return {
        title: "재고가 부족해 완료하지 못했습니다",
        detail: "차감할 재고가 모자랍니다. 실물 수량과 재고 현황을 확인한 뒤 다시 시도하세요.",
      };
    }
    if (error.is("INVALID_STATE")) {
      return {
        title: "지금은 완료할 수 없는 상태입니다",
        detail:
          "이미 완료되었거나 포장 진행 상태가 아닙니다. 토트를 다시 스캔해 현재 상태를 확인하세요.",
      };
    }
  }
  return { title: "포장 완료에 실패했습니다", detail: error.message };
}
