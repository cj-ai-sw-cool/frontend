"use client";

import { Btn } from "./win98-ui";

/**
 * 목업 우측 하단의 두 버튼 — 목업 표기는 `Capture` / `Save to DB` 였지만
 * 화면 문구는 **`촬영` / `등록`** 이다 (사용자 결정). 나머지 라벨이 영문인 화면에서 이 둘만
 * 한글인 것은, 작업자가 실제로 누르는 버튼이 이 둘뿐이기 때문이다 — 읽고 지나가는 라벨과
 * 손이 가는 버튼의 무게가 다르다.
 * 우리 흐름으로는 촬영(1-3) / 확정·입고(1-4 → 1-5 연쇄)다.
 *
 * ⚠️ win98 에는 색 위계가 없다. 두 버튼이 같은 회색 판이고, 목업도 그렇다 — 그래서
 *    "무엇이 주요 행동인가"를 색으로 말할 수 없다. 대신 **글자 굵기와 폭**으로 가른다:
 *    `등록` 이 굵고 넓다(flex-[1.3]). 다크 네온 판(v3)에서 네온 채움이 하던 일이다.
 *
 * ★ 잠긴 이유는 버튼 **밖** 한 줄로 뺀다. 버튼만 잠그면 작업자가 원인을 모르고, 버튼 안에
 *   넣으면 버튼이 안내판이 된다. 밖에 있으면 버튼 크기를 바꾸지 않고도 길게 쓸 수 있다.
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
  captureLabel: string;
  canCapture: boolean;
  isCapturing: boolean;
  isCaptureUrged: boolean;
  onCapture: () => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  submitBusyLabel: string;
  submitHint: string;
  onSubmit: () => void;
}) {
  /* ⚠️ `gap-1 pt-2` 를 뺐다. 아래 안내 줄이 있을 때 그 줄과 버튼을 띄우려고 둔 여백인데,
     줄이 사라진 지금은 위 Product Manifest 만 밀어내고 있었다. 회수한 만큼 상세 칸이
     커진다 — 우측 열에서 늘어나는 칸은 그것 하나다. */
  return (
    <div className="flex shrink-0 flex-col">
      {/* ★ 버튼 높이를 80 → 128px 로 키웠다 (사용자 지적 — 아래가 비어 보였다).
          늘어난 48px 은 위 Product Manifest(flex-1)가 내준다. 이 화면에서 손이 가는 곳이
          이 두 버튼이라 크게 두는 편이 맞다 — 장갑 낀 손으로 누르는 화면이기도 하다.
          ⚠️ `mt-auto` 를 뺐다. 위 칸이 flex-1 이라 이미 바닥에 붙어 있어 하는 일이 없었다.
          ⚠️ Stage 3 에서 128 → **112px** 로 다시 줄였다 — 우측 열에 "미검수 품목"·"검수
             입력" 두 칸이 새로 들어오며 고정 높이 예산을 넘겨, "상품 정보" 칸이 잘리는
             문제가 났다(사용자 보고). 여전히 원래 80px 보다는 크고, 장갑 낀 손으로도
             누를 수 있는 폭이라 판단했다 — 다만 이 트레이드오프는 확인이 필요하다. */}
      <div className="flex h-28 gap-2">
        {/* 촬영 / 재촬영.
            ★ 게이트 미통과·측정 실패면 이 버튼이 **빨갛게** 바뀐다 (사용자 결정).
              그때 라벨도 `재촬영` 이라 색과 글자가 같은 말을 한다 — 지금 해야 할 일이 이것이다.
              해제 수단 두 갈래 중 하나이고, 다른 하나는 위 `수동 입력` 버튼이다 (§1-3).
            ⚠️ inline style 로 칠하는 이유: 채움색을 CSS Module 의 `.btn`(background-color:
               surface)이 이미 잡고 있어서, Tailwind 의 bg 유틸리티와 명시도가 같아 어느 쪽이
               이길지가 스타일시트 순서에 달린다. 인라인이면 그 순서 싸움이 없다.
            ⚠️ 베벨은 그대로 둔다 — 색만 바뀌고 win98 버튼의 입체감은 유지된다. */}
        <Btn
          disabled={!canCapture}
          onClick={onCapture}
          title={
            isCaptureUrged
              ? "재촬영으로 게이트를 다시 통과시킵니다 (1-3)"
              : "카메라 3대 + 저울 (1-3)"
          }
          style={
            isCaptureUrged ? { backgroundColor: "var(--status-error)", color: "#ffffff" } : undefined
          }
          /* ★ **아이콘 없이 글자만** 둔다 (사용자 결정). 두 버튼이 "아이콘+글자"라는 같은
               모양이면 형태로는 구분되지 않는다. 글자만 크게 두면 생김새부터 다르고, 이
               화면에서 손이 가는 곳이 여기라 멀리서도 읽혀야 한다.
             ★ 22px · 굵게. 버튼 높이가 128px 이라 이 정도는 되어야 칸이 안 비어 보인다.
             ⚠️ 진행 중 스피너도 뺐다 — 아이콘을 없애기로 한 자리에 스피너만 남으면 결국
                아이콘이 있는 셈이다. 대신 글자가 `촬영 중…` 으로 바뀌고 버튼이 잠긴다. */
          className="flex flex-1 items-center justify-center text-[22px] font-bold"
        >
          {/* ⚠️ **줄 높이를 글자 크기에 맞춰 준다.** 이 스킨은 `.theme` 에서 `line-height: 16px`
                 을 전역으로 걸어 두는데(목업이 15px 글자 기준이라 그렇다), 여기서 글자만
                 22~24px 로 키우면 줄 상자는 16px 그대로다. 맑은 고딕 글리프는 라틴보다 위로
                 크게 뻗어서 그 상자를 넘고, `truncate`(overflow:hidden)가 넘친 윗부분을
                 잘라 낸다 — 화면에서 `촬영` 의 ㅊ 머리가 날아간 게 이것이다. */}
          <span className="max-w-full truncate leading-[34px]">
            {isCapturing ? "촬영 중…" : captureLabel}
          </span>
        </Btn>

        <Btn
          disabled={!canSubmit}
          onClick={onSubmit}
          title={submitHint}
          /* ★ **지금 누를 수 있으면 파랗게** 바뀐다 (사용자 제안).
             촬영해서 게이트를 통과한 신규 물품이 정확히 그 상태이고, 치수가 이미 확정된
             상품(REGISTERED)도 같은 상태라 색이 갈릴 이유가 없다 — 조건을 "게이트 통과"가
             아니라 **"등록이 실제로 가능한가"** 로 잡은 이유다. 버튼이 색으로 말하는 것은
             언제나 "지금 이걸 눌러도 된다" 하나여야 한다.
             ★ 두 버튼의 색이 서로 다른 말을 한다: 촬영이 빨개지면 **막혔으니 풀어라**,
               등록이 파래지면 **다 됐으니 넣어라**. 동시에 켜지는 일이 없다.
             ⚠️ 네이비는 이 스킨의 타이틀바 색이다 — 새 색을 들이지 않았다.
             ⚠️ inline style 인 이유는 촬영 버튼과 같다(CSS Module 의 `.btn` 과 명시도 충돌). */
          style={
            canSubmit && !isSubmitting
              ? { backgroundColor: "var(--primary)", color: "#ffffff" }
              : undefined
          }
          className="flex flex-[1.3] items-center justify-center text-[24px] font-bold"
        >
          {/* 등록이 주요 행동이라 촬영보다 두 단계 크다(22 → 24px). 폭도 이미 1.3 배다 —
              크기와 폭이 같은 말을 해야 "이쪽을 눌러라"가 한눈에 읽힌다 */}
          <span className="max-w-full truncate leading-[36px]">
            {isSubmitting ? submitBusyLabel : "등록"}
          </span>
        </Btn>
      </div>

      {/* ★ 화면 맨 아래 안내 줄을 **없앴다** (사용자 결정 — "지저분하니까 안 뜨게").
          이 줄은 `게이트 미통과 (LOW_CONFIDENCE · ASPECT_RATIO_ANOMALY) — …` 처럼 길어서
          늘 잘려 나갔고, 잘린 문장은 정보가 아니라 노이즈다. 같은 말을 이미 두 곳이 하고
          있다 — 측정 상자 위 빨간 줄이 "왜 막혔는지"를, 버튼 색이 "지금 눌리는지"를.
          ⚠️ 문구 자체는 버리지 않고 버튼의 `title` 로 남겨 뒀다(위 Btn 들 참고). 마우스를
             올리면 전문이 뜬다 — 줄바꿈 걱정 없이 긴 사유를 그대로 보여 줄 수 있는 자리다. */}
    </div>
  );
}
