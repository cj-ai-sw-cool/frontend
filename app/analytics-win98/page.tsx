"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { FlowPanel } from "./_components/flow-panel";
import { MonthlyPanel } from "./_components/monthly-panel";
import { Panel, Sunken, w98 } from "./_components/win98-ui";

/* 창고 맵은 캔버스와 `ResizeObserver` 를 쓰므로 서버에서 그릴 수 없다.
   ⚠️ `ssr: false` 를 빼면 빌드 시 정적 생성 단계에서 `window` 를 찾다가 터진다. */
const WarehouseMap = dynamic(() => import("./_components/warehouse-map"), {
  ssr: false,
  loading: () => (
    <Sunken className="flex min-h-0 flex-1 items-center justify-center">
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>맵 불러오는 중…</span>
    </Sunken>
  ),
});

/**
 * 창고 3D — 지도를 누르면 전체 화면으로 뜬다.
 *
 * ★ 이 컴포넌트만은 **창고 라우트에서 그대로 가져온다.** 이 저장소는 win98 화면마다
 *   `_components` 를 따로 갖는 것이 규칙이지만, 그 규칙은 셸(타이틀바·태스크바·네비)처럼
 *   화면마다 다르게 만지고 싶은 것들을 위한 것이다. 이건 2,000줄짜리 three.js 씬이고
 *   지금도 계속 손보는 중이라, 복사본을 두면 두 벌이 반드시 어긋난다 — 한 화면에서만
 *   트럭이 바뀌거나 조명이 다른 사고가 난다.
 *   (2D 지도는 반대다. 그쪽은 3D 씬 없이 혼자 돌아야 해서 사본이 필요했다.)
 * ⚠️ `ssr: false` 여야 한다. three.js 가 모듈 최상단에서 `document` 를 만진다.
 * ⚠️ 눌렀을 때만 불러온다 — 분석 화면을 열 때마다 3D 번들을 받아 오면 첫 로딩이 무거워진다.
 */
const WarehouseSlot3D = dynamic(
  () => import("../warehouse-win98/_components/warehouse-slot-3d"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#10151C] text-sm text-[#8FA3B8]">
        3D 창고 불러오는 중…
      </div>
    ),
  },
);

/**
 * 분석 화면 (win98 스킨) — **아직 비어 있다.** 자리와 생김새만 잡아 둔 뼈대다 (사용자 요청).
 *
 * ★ 지금 채우지 않는 이유: 이 화면은 **P3 담당**이고(docs/05-team-plan.md §2), 어떤 수치를
 *   무슨 API 로 가져올지가 아직 정해지지 않았다. 숫자를 지어내 채우면 시연 중에 "저 값은
 *   어디서 온 거냐"는 질문에 답할 수 없고, 나중에 진짜 값이 붙을 때 오히려 걷어내야 한다.
 *   그래서 **모든 칸이 `--` 이고 `준비 중` 이라고 스스로 말한다.**
 *
 * ⚠️ 여기 적힌 항목 이름(처리량·평균 처리시간·오류율…)은 **가정이다.** 계약이 정해지면
 *    그때 맞춰 바꾼다. 자리를 잡아 두는 것이 목적이지 항목을 확정하는 것이 아니다.
 *
 * 셸(데스크톱·태스크바·창 크롬·좌측 네비)은 이 라우트의 layout.tsx 가 그린다.
 * 다른 두 화면과 마찬가지로 **코드를 공유하지 않는다** — 각자 한 벌씩 갖는다.
 *
 * ── 세로·가로 예산 ──────────────────────────────────────────────────────────
 *   화면 영역 = 1390 × 872 (layout.tsx 주석 참고)
 *   ★ 위에 있던 요약 카드 넷(Packed·Inbound·Avg.Time·Mismatch)을 걷어냈다. 페이지를
 *     통째로 세 칸으로 나누라는 요청이었고, 네 카드는 전부 `--` 였다 — 자리만 차지하고
 *     아무것도 말하지 않는 줄이 화면 위쪽 120px 를 먹고 있었다.
 *   세로: 세 칸 모두 화면 높이를 다 쓴다
 *   가로: 같은 폭 세 칸 (flex-1 x 3 + gap 8 x 2)
 */
/* ── 페이지 전체를 세 칸으로 ────────────────────────────────────────────────
   ★ 한 열에 **패널 하나씩**, 같은 폭 세 칸이 화면 높이를 다 쓴다. 위아래로 더 쪼개지
     않는다 — 칸이 여섯 개가 되면 어디부터 봐야 하는지가 없어지고, 창고 맵처럼 세로가
     필요한 것이 눌린다.
   ⚠️ 세 칸 모두 `min-w-0` 이 있어야 한다. 없으면 안쪽 캔버스가 줄어들지 못해 그 칸이
      제 몫보다 넓어지고, 나머지 두 칸이 밀려 찌그러진다. */
export default function AnalyticsPage() {
  /* 3D 전체 화면이 떠 있는가 */
  const [full, setFull] = useState(false);
  const close = useCallback(() => setFull(false), []);

  /* Esc 로 닫는다.
     ⚠️ 리스너는 **떠 있을 때만** 붙인다. 늘 붙여 두면 3D 를 열지도 않았는데 Esc 를 가로채,
        나중에 이 화면에 팝업이나 입력이 생겼을 때 그쪽 Esc 를 먹는다.
     ⚠️ `capture` 로 받는다. 3D 판은 자기 캔버스에 포인터 이벤트를 잡아 두는데, 키 이벤트가
        그 안에서 멈추는 경우가 있어 버블링만 기다리면 놓칠 수 있다. */
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setFull(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [full]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* ── 위 — 흐름도 한 줄이 **화면 폭을 다 쓴다** ────────────────────
          ★ 전에는 왼쪽 3/4 만 쓰고 오른쪽 칸이 위아래로 붙어 있었다. 흐름도를 더 넓게
            달라는 요청에 맞춰, 이 줄을 **전체 폭**으로 올리고 지도·재고를 그 아래 나란히
            놓았다. 974 → 1390 이라 네 단계에 각각 320px 이 돌아간다.
          ★ 120 → **170px** (사용자 요청 — 글씨를 크게, 세련되게). 글자를 키우려면 세로가
            있어야 한다. 안쪽 122px 이면 이름 / 큰 숫자 / 부연 세 줄이 넉넉히 들어간다. */}
      <Panel title="Flow — 입출고 흐름" className="h-[170px] shrink-0">
        <FlowPanel />
      </Panel>

      <div className="flex min-h-0 flex-1 gap-2">
        {/* ★ 지도를 **가장 넓고 높은 칸**에 둔 이유: 가로 33m x 세로 22m 짜리 그림이라
            가로로 넉넉해야 구역 이름과 채움 수가 겹치지 않고 다 들어간다.
            ⚠️ 이 지도는 창고 화면의 사본이다 — `warehouse-map.jsx` 머리말 주의 참고. */}
        <Panel title="Warehouse — 실시간 창고 맵" className="min-h-0 min-w-0 flex-1">
          <Sunken className="flex min-h-0 flex-1 flex-col p-1.5">
            <WarehouseMap onOpen3D={() => setFull(true)} />
          </Sunken>
        </Panel>

        {/* ── 오른쪽 — 추이 그래프 ──
            ★ 규격별 재고 → 일별 추이 → **월간 지표** 로 두 번 갈아엎은 자리다 (사용자 결정).
              앞엣것은 아래 지도와 겹쳤고, 뒤엣것은 뜻이 한눈에 안 왔다. 달 단위로 묶으니
              세 달의 이야기가 또렷해진다 — 자세한 것은 `monthly-panel.tsx` 머리말.
            ★ 폭은 372 → 300 → **402px**. 글씨를 키우려면 폭도 있어야 하고, 마침 위 흐름도를
              키운 만큼 지도가 요구하는 폭도 줄어서 그 자리가 났다.
            ⚠️ 이 폭과 위 흐름도 높이는 **지도의 여백을 함께 정한다.** 지도는 가로:세로가
               32.62 : 21.70 (= 1.5032) 로 고정이라, 남는 칸이 그 비율과 다르면 짧은 쪽에
               회색 띠가 남는다.

            ── 계산 (바꿀 때 여기부터 다시 재라) ────────────────────────────
              화면 영역 1390 x 872 (layout.tsx), 칸 사이 gap 8
              패널 껍데기(제목줄·테두리·안쪽 여백 합):
                가로 36 = 테두리 2 + p-2 16 + Sunken 테두리 2 + p-1.5 12 + 지도 테두리 4
                세로 66 = 위 36 에 제목줄 16 + mb-1 4 + etched 2 + mb-2 8 을 더한 값
              지도 안쪽 = (1390 - 8 - 이 폭 - 36) x (872 - 위 높이 - 8 - 66)
                170 / 402 → 944 x 628 → 944/32.62 = 628/21.70 = **28.94 px/m** (띠 0)
                120 / 300 → 1046 x 678 → 31.24 px/m (좌우 13px 씩 띠)
            ★ 흐름도를 키우면서 이 폭도 **같이 늘렸다**(300 → 402). 위를 키우면 지도가 낮아지고,
              그러면 지도가 요구하는 폭도 함께 줄어든다 — 한쪽만 만지면 그만큼이 띠로 남는다.
              지도 축척은 31.24 → 28.94 로 7% 작아지지만 여백이 0 이라 실제 그림은 거의 같다. */}
        <Panel title="Monthly — 월간 입출고 지표" className="min-h-0 w-[402px] shrink-0">
          <MonthlyPanel />
        </Panel>
      </div>

      {/* ── 3D 전체 화면 ────────────────────────────────────────────────
          ⚠️ 크기를 `inset-0` 이 아니라 **1600 x 1004 로 박는다.** `position: fixed` 의 기준은
             transform 이 걸린 가장 가까운 조상 = 스테이지인데, 그 transform 은 하이드레이션
             뒤에 JS 가 얹는다. 첫 한 프레임 동안은 기준이 뷰포트라 `inset-0` 이면 크기가
             튄다(레이아웃 파일의 같은 주의 참고).
          ⚠️ z-200 은 분석 창(z-60)·공용 헤더(z-50)·네비(z-40)보다 위다. */}
      {full && (
        <div className="fixed top-0 left-0 z-[200] h-[1004px] w-[1600px] bg-[#10151C]">
          <WarehouseSlot3D initialTab="3d" />
          <button
            type="button"
            onClick={close}
            className="absolute top-3 right-3 z-10 cursor-pointer rounded border border-[rgba(150,180,215,.28)] bg-[rgba(12,17,24,.86)] px-3 py-1.5 text-xs font-bold text-[#DCE5EF] hover:border-[#FF8A2A]"
          >
            ESC 닫기 ✕
          </button>
        </div>
      )}
    </div>
  );
}
