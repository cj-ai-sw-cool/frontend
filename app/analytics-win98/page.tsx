"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { InventoryPanel } from "./_components/inventory-panel";
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
    <div className="flex min-h-0 flex-1 gap-2">
      {/* ── 왼쪽 (3/4) — 위 좁게, 아래 넓게 ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        {/* ★ 이 칸은 원래 "Throughput — 시간대별 처리량" 이었고 비어 있었다. 그 수치는
            아직 계약이 없는데 **재고는 이미 실측 데이터로 돌아간다** — 비어 있는 자리를
            붙들고 있는 것보다 지금 보여 줄 수 있는 것을 놓는 편이 낫다 (사용자 요청).
            ⚠️ 숫자는 아래 창고 맵과 **같은 함수**에서 온다. 자세한 것은
               `inventory-panel.tsx` 머리말 참고.
            높이 228 → **150px** (창고 맵을 키우고 나머지 둘을 줄였다).
            ⚠️ 이 값과 아래 Alerts 폭은 **한 쌍으로 움직인다.** 지도는 가로:세로가
               32.62 : 21.70 (= 1.5032) 로 고정이라, 남는 칸이 그 비율보다 길쭉하거나
               납작하면 짧은 쪽에 회색 띠가 남는다. 둘 중 하나만 바꾸면 키운 만큼이
               그대로 띠가 된다 — 계산은 아래 Alerts 주석에 적어 두었다. */}
        <Panel title="Inventory — 박스 규격별 재고" className="h-[150px] shrink-0">
          <InventoryPanel />
        </Panel>

        {/* ★ 원래 처리량 그래프가 이 칸을 다 쓰고 있었다. 그 수치는 아직 계약이 없지만
            **창고 지도는 이미 실측 데이터로 돌아간다.** 비어 있는 자리를 붙들고 있는 것보다
            지금 보여 줄 수 있는 것을 놓는 편이 낫다 — 그래프는 위 좁은 칸으로 옮겼다.
            ★ 지도를 **가장 넓고 높은 칸**에 둔 이유: 가로 33m x 세로 22m 짜리 그림이라
              가로로 넉넉해야 구역 이름과 채움 수가 겹치지 않고 다 들어간다.
            ⚠️ 이 지도는 창고 화면의 사본이다 — `warehouse-map.jsx` 머리말 주의 참고. */}
        <Panel title="Warehouse — 실시간 창고 맵" className="min-h-0 flex-1">
          <Sunken className="flex min-h-0 flex-1 flex-col p-1.5">
            <WarehouseMap onOpen3D={() => setFull(true)} />
          </Sunken>
        </Panel>
      </div>

      {/* ── 오른쪽 — 세로로 긴 목록 한 칸 ──
          ⚠️ 원래 여기에 "Line Status — 라인별 현황" 도 같이 있었다. 세 칸으로 나누라는
             요청이라 한 칸을 비워야 했고, 경고 목록을 남겼다 — 대시보드에서 먼저 찾게 되는
             것은 "무엇이 잘못됐나"이고, 좁고 긴 칸은 그 목록에 맞는 모양이다.
          ★ 344 → 500 → 460 → **372px**. 좁히는 것이 아니라 **비율을 맞추는** 것이다.
            지도는 `contain` 이 아니라 패널 비율에 세계를 맞춰 늘리는데(`warehouse-map`
            의 `worldD` 참고), 늘릴 수 있는 한계가 `needD` 다. 그 한계에 걸리면 짧은
            쪽에 띠가 남는다.

          ── 계산 (바꿀 때 여기부터 다시 재라) ──────────────────────────────
            화면 영역 1390 x 872 (layout.tsx), 칸 사이 gap 8
            지도 세계 = 32.62m x 21.70m → 비율 1.5032
            패널 껍데기(제목줄·테두리·안쪽 여백 합):
              가로 36 = 테두리 2 + p-2 16 + Sunken 테두리 2 + p-1.5 12 + 지도 테두리 4
              세로 66 = 위 36 에 제목줄 16 + mb-1 4 + etched 2 + mb-2 8 을 더한 값
            지도 안쪽 = (1390 - 8 - 이 폭 - 36) x (872 - 위 높이 - 8 - 66)
              150 / 372 → 974 x 648 → 974/32.62 = 648/21.70 = **29.86 px/m** (띠 0)
              옛 값 228 / 460 → 886 x 570 → min(27.16, 26.27) = 26.27 (좌우 14.5px 띠)
            → 축척이 26.27 에서 29.86 로, 그림이 **가로세로 14% · 넓이 30% 커진다.**
          ⚠️ 한쪽만 줄여도 안 커진다. 지금은 **높이에 걸려** 있어서, Alerts 만 좁히면
             좌우 띠만 넓어지고 지도는 그대로다. 위 칸 높이를 같이 줄여야 한다. */}
      <Panel title="Alerts — 이상 항목" className="min-h-0 w-[372px] shrink-0">
        <Placeholder />
      </Panel>

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

/**
 * 빈 칸 — **아무것도 그리지 않는다** (사용자 결정).
 *
 * ★ 예전에는 아이콘 + "그래프 자리" + 마퀴 막대 + "준비 중 — 담당 P3" 를 띄웠다. 자리를
 *   설명하려던 것인데, 두 칸이 같은 문구로 깜빡이고 있으니 화면이 **공사 중 안내판**처럼
 *   보였다. 채울 내용이 정해지면 그때 넣기로 하고, 지금은 빈 칸으로 둔다.
 * ⚠️ 그래도 `Sunken` 은 남긴다. 테두리까지 없애면 칸이 몇 개인지, 어디부터 어디까지가
 *    한 칸인지가 사라진다 — 비어 있는 것과 없는 것은 다르다.
 */
function Placeholder() {
  return <Sunken className="min-h-0 flex-1 bg-[color:var(--surface-bright)]" />;
}
